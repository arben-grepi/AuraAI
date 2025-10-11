import UserInfo from "@/components/auth/user-info";
import UserOrgs from "@/components/admin/user-orgs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Uploader } from "@/components/upload";

export default function Home() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserInfo />
        <Uploader />
        <UserOrgs />
      </div>
    </div>
  );
}
