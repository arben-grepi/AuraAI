import prisma from "@/lib/prisma";

async function makeDefaultUserAdmin() {
  const emails = ["timi@alius.se"];

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: emails,
      },
    },
  });

  if (users.length === 0) {
    console.log("No users found");
    return;
  }

  await Promise.all(
    users.map((user) =>
      prisma.user.update({
        where: { id: user.id },
        data: { role: "admin" },
      }),
    ),
  );

  console.log(`Updated ${users.length} user(s) to admin role`);
  users.forEach((user) => {
    console.log(`- ${user.email} (${user.id})`);
  });
}

makeDefaultUserAdmin()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
