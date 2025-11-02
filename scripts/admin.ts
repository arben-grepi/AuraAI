import prisma from "@/lib/prisma";

async function makeDefaultUserAdmin() {
  const emails = ["ledionrestelica7@gmail.com", "ledionres@gmail.com"];

  if (emails.length !== 2) {
    console.log("Please provide exactly 2 email addresses");
    return;
  }

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

  if (users.length < 2) {
    console.log(`Only found ${users.length} user(s), expected 2`);
    const foundEmails = users.map((u) => u.email);
    const missingEmails = emails.filter((e) => !foundEmails.includes(e));
    console.log("Missing emails:", missingEmails);
    return;
  }

  // Update both users
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
