import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import UserMetaCard from "../components/UserProfile/UserMetaCard";

interface Contributor {
  name: string;
  role: string;
  email: string;
  linkedinUrl?: string;
  avatarUrl?: string;
  githubUrl?: string;
}

const DEFAULT_LINKEDIN_URL = "https://www.linkedin.com/";
const DEFAULT_AVATAR_URL = "/images/ANU_Crest_Inversed_Gold.png";

const contributors: Contributor[] = [
  {
    name: "Herman Tang",
    role: "Contributor",
    email: "zhiheng.tang@anu.edu.au",
    linkedinUrl: "https://www.linkedin.com/in/herman-tang/",
    avatarUrl: "/images/user/Herman.png",
    githubUrl: "https://github.com/DDQXZcp",
  },
  {
    name: "Brian Zhang",
    role: "Contributor",
    email: "u8051120@anu.edu.au",
  },
  {
    name: "Yang Lin",
    role: "Contributor",
    email: "u7418662@anu.edu.au",
  },
  {
    name: "Hadis Amin",
    role: "Contributor",
    email: "u8050066@anu.edu.au",
  },
  {
    name: "Zice Yan",
    role: "Contributor",
    email: "u7389455@anu.edu.au",
  },
  {
    name: "Lachlan Major",
    role: "Contributor",
    email: "u7676758@anu.edu.au",
  },
];

export default function Contributors() {
  return (
    <>
      <PageMeta
        title="Contributors | DishPatch Control Frontend"
        description="Contributor list for the DishPatch control frontend"
      />

      <PageBreadcrumb pageTitle="Project Info" />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 lg:mb-7">
          Meet Our Team
        </h3>

        <div className="space-y-4">
          {contributors.map((contributor) => (
            <UserMetaCard
              key={contributor.email}
              name={contributor.name}
              role={contributor.role}
              location="Canberra, Australia"
              linkedinUrl={
                contributor.linkedinUrl ?? DEFAULT_LINKEDIN_URL
              }
              avatarUrl={
                contributor.avatarUrl ?? DEFAULT_AVATAR_URL
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}