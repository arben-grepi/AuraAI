import UserInfo from "@/components/auth/user-info";
import { ThemeToggle } from "@/components/theme-toggle";
import { Uploader } from "@/components/upload";

export default function Home() {
  return (
    <div>
      <ThemeToggle />
      <UserInfo />
      <Uploader />
    </div>
  );
}
