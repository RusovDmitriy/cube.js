/* eslint-disable no-case-declarations */
const { Parser } = require('node-sql-parser');
const SqlString = require('sqlstring');

const SORT_ORDER = {
  ASC: 1,
  DESC: -1
};

module.exports = class SqlTransformer {
  constructor() {
    this.parser = new Parser();
  }

  sqlToMongoNative(query, values) {
    const sql = SqlString.format(query.trim(), values);
  
    const ast = this.parser.astify(sql);
    if (!['select', 'create'].includes(ast.type)) throw new Error(`Operation ${ast.type} not supported yet`);
    
    return {
      table: ast.from[0].table,
      ...this[ast.type](ast)
    };
  }

  select(ast) {
    const result = {
      method: 'aggregate',
      options: []
    };

    if (ast.from) {
      const aggPipeline = [];

      if (ast.where) aggPipeline.push({ $match: this.prepareWhere(ast, ast.where, false) });

      aggPipeline.push(this.prepareGroupBy(ast));
      
      // Todo add to $project only selected columns
      aggPipeline.push({ $project: { _id: 0 } });

      if (ast.orderby) aggPipeline.push(this.prepareOrderBy(ast));
      if (ast.having) aggPipeline.push({ $match: this.prepareWhere(ast, ast.having, true) });
      if (ast.limit) aggPipeline.push(...this.prepareLimit(ast));

      result.options = aggPipeline;
    } else {
      // Todo check and return some expression result
      throw new Error('Query without `FROM table` not supported yet');
    }

    return result;
  }

  //* MongoDB create database automaticaly
  create() {
    return {
      method: null,
      options: null
    };
  }

  aggFnConvert(f) {
    return {
      count: { $sum: 1 },
      sum: { $sum: `$${f.expr.args.expr.column || f.expr.args.expr.value}` },
      avg: { $avg: `$${f.expr.args.expr.column || f.expr.args.expr.value}` }
    }[f.expr.name.toLowerCase()];
  }

  aliasOfField(field) {
    const { as, expr } = field;
    return as || `${expr.name.toLowerCase()}(${expr.args.expr.value})`;
  }

  prepareGroupBy(ast) {
    const dimensions = (ast.groupby || []).reduce((obj, f) => {
      let value;
      let asName;

      if (f.type === 'number') {
        value = ast.columns[f.value - 1].expr.column;
        asName = this.aliasOfField(ast.columns[f.value - 1]);
      } else if (f.type === 'column_ref') {
        value = f.column;
        asName = f.column;
      }

      obj[asName || value] = `${value}`;
      return obj;
    }, {});


    const groupId = Object.keys(dimensions).reduce((obj, fName) => {
      obj[fName] = `$${dimensions[fName]}`;
      return obj;
    }, {});

    const dimensionFields = Object.keys(dimensions).reduce((obj, fName) => {
      obj[fName] = { $first: `$${dimensions[fName]}` };
      return obj;
    }, {});

    const metricFields = ast.columns.filter(f => f.expr.type === 'aggr_func').reduce((obj, f) => {
      obj[this.aliasOfField(f)] = this.aggFnConvert(f);
      return obj;
    }, {});

    return {
      $group: {
        _id: ast.groupby ? groupId : 1,
        ...dimensionFields,
        ...metricFields
      }
    };
  }

  findMetricAlias(ast, expr) {
    const { type, name, args } = expr;
    const field = ast.columns.find(f => f.expr.type === type &&
      f.expr.name === name &&
      JSON.stringify(f.expr.args) === JSON.stringify(args));

    const isNumber = field.expr.type === 'aggr_func';
    
    return { isNumber, alias: this.aliasOfField(field) };
  }

  prepareWhere(ast, where, having = false) {
    const result = {};
    const operator = where.operator.toLowerCase();
    
    let condition = null;
    let column = null;
    const operatorMap = {
      '>': '$gt',
      '>=': '$gte',
      '<=': '$lte',
      '<': '$lt',
      or: '$or',
      '||': '$or',
      and: '$and',
      '&&': '$and',
      '<>': '$ne',
      'is not': '$ne',
      '=': '$eq',
      is: '$eq',
      in: '$in',
      'not in': '$nin',
      like: '$regex'
    };

    switch (operator) {
      case 'or':
      case '||':
      case 'and':
      case '&&':
        column = operatorMap[operator];
        condition = [
          this.prepareWhere(ast, where.left, having),
          this.prepareWhere(ast, where.right, having)
        ];
        break;

      case '<>':
      case 'is not':
      case '=':
      case 'is':
      case '>':
      case '>=':
      case '<':
      case '<=':
      case 'in':
      case 'not in':
      case 'like':
        column = where.left.column;
        let isNumber = false;

        if (having) {
          const metric = this.findMetricAlias(ast, where.left);
          isNumber = metric.isNumber;
          column = metric.alias;
        }

        // eslint-disable-next-line no-inner-declarations
        function prepareVal(val) {
          return isNumber ? +val : val;
        }

        if (['in', 'not in'].includes(operator)) {
          condition = { [operatorMap[operator]]: where.right.value.map(x => prepareVal(x.value)) };
        } else if (operator === 'like') {
          condition = { [operatorMap[operator]]: new RegExp(where.right.args.value[1].value) };
        } else {
          condition = { [operatorMap[operator]]: prepareVal(where.right.value) };
        }
        break;

      default:
        break;
    }

    if (condition && column) {
      Object.assign(result, { [column]: condition });
    }

    return result;
  }

  prepareOrderBy(ast) {
    const fields = ast.orderby.reduce((obj, f) => {
      const { expr } = f;
      let value;
      let asName;

      if (expr.type === 'number') {
        value = ast.columns[expr.value - 1].expr.column;
        asName = this.aliasOfField(ast.columns[expr.value - 1]);
      } else if (expr.type === 'aggr_func') {
        asName = this.aliasOfField(f);
      } else if (expr.type === 'column_ref') {
        asName = expr.column;
      }

      obj[asName || value] = SORT_ORDER[f.type];
      return obj;
    }, {});

    return { $sort: fields };
  }

  prepareLimit(ast) {
    const res = [];
    const [limit, offset] = ast.limit.value;

    if (ast.limit.seperator === 'offset') res.push({ $skip: offset.value });
    res.push({ $limit: limit.value });

    return res;
  }
};
