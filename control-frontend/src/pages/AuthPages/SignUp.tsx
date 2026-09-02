import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Sign Up | DishPatch Control System"
        description="Create a DishPatch Control System account."
      />
      <AuthLayout
        title="Create an account"
        footer={
          <p className="text-sm text-app-text-secondary">
            Already have an account?{" "}
            <Link
              to="/signin"
              className="font-semibold text-brand-500 transition-colors hover:text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
