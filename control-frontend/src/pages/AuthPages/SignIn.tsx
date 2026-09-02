import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign In | DishPatch Control System"
        description="Sign in to the DishPatch Control System dashboard."
      />
      <AuthLayout
        title="Welcome back"
        footer={
          <p className="text-sm text-app-text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="font-semibold text-brand-500 transition-colors hover:text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              Sign up
            </Link>
          </p>
        }
      >
        <SignInForm />
      </AuthLayout>
    </>
  );
}
