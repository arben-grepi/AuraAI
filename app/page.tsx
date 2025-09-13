import UserInfo from "@/components/auth/user-info";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div>
      <ThemeToggle />
      <UserInfo />
    </div>
  );
}
