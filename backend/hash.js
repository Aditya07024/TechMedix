import bcrypt from "bcrypt";

const password = "admin123";

bcrypt.hash(password, 10).then(hash => {
  console.log("HASH:", hash);
});