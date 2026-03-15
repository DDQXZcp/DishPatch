import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="ANU Graduation Requirement Checker Dashboard by Herman Tang"
        description="This is the ANU Graduation Requirement Checker Dashboard page by Herman Tang"
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
