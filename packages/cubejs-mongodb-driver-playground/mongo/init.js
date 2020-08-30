// eslint-disable-next-line no-undef
db.createUser(
  {
    user: "test-user",
    pwd: "test-password",
    roles: [
      {
        role: "readWrite",
        db: "test"
      }
    ]
  }
);
