import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthGate } from "@/components/auth/AuthGate";

export default function Home() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
