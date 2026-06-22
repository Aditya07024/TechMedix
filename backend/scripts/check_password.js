import bcrypt from "bcrypt";

async function run() {
  const hash = "$2b$10$9f0Wcjwdxc13Oj7pns/jg.EOcEh.tLid51WCSiuUOAOOVTPKOHWjC";
  const passwords = ["1234567890", "123456789", "admin123", "admin", "password", "TechMedix@Mobile"];
  
  for (const pw of passwords) {
    const match = await bcrypt.compare(pw, hash);
    console.log(`Password: "${pw}" -> match:`, match);
  }
}

run();
