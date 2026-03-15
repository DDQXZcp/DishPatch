import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="ANU Graduation Requirement Checker Dashboard by Herman Tang"
        description="This is the ANU Graduation Requirement Checker Dashboard page by Herman Tang"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
