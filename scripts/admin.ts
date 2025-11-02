import prisma from "@/lib/prisma";

async function makeDefaultUserAdmin() {
  const data = await prisma.user.findFirst({
    where: {
      email: "ledionrestelica7@gmail.com",
    },
  });
  if (!data) {
    console.log("User not found");
    return;
  }
  await prisma.user.update({
    where: { id: data.id },
    data: { role: "admin" },
  });
  console.log("User updated");
}

makeDefaultUserAdmin()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
