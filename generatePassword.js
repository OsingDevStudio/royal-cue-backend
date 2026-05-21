import bcrypt from "bcrypt";

const generate = async () => {

  const adminPassword = await bcrypt.hash(
    "admin123",
    10
  );

  const kasirPassword = await bcrypt.hash(
    "kasir123",
    10
  );

  console.log("ADMIN:");
  console.log(adminPassword);

  console.log("KASIR:");
  console.log(kasirPassword);
};

generate();