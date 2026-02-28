import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  user: ["create", "list", "set-role", "ban", "delete"],
  organization: ["create", "delete", "update"],
  session: ["list", "revoke", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const admin = ac.newRole({
  user: ["create", "list", "ban", "delete"],
  organization: ["create", "delete", "update"],
});

export const superadmin = ac.newRole({
  user: ["create", "list", "set-role", "ban", "delete"],
  organization: ["create", "delete", "update"],
  session: ["list", "revoke", "delete"],
});
