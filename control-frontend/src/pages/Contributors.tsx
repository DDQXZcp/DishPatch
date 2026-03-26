import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";

const contributors = [
    {
    name: "Brian Zhang",
    role: "Contributor",
    email:"u8051120@anu.edu.au",
  },
  {
    name: "Yang Lin",
    role: "Contributor",
    email:"u7418662@anu.edu.au",
  },
  {
    name: "Hadis Amin",
    role: "Contributor",
    email:"u8050066@anu.edu.au",
  },
  {
    name: "Zice Yan",
    role: "Contributor",
    email:"u7389455@anu.edu.au",
  },
  {
    name: "Lachlan Major",
    role: "Contributor",
    email:"u7676758@anu.edu.au",
  },
];

export default function Contributors() {
  return (
    <>
      <PageMeta
        title="Contributors | DishPatch Control Frontend"
        description="Contributor list for the DishPatch control frontend"
      />
      <PageBreadcrumb pageTitle="Contributors" />

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          DishPatch Team Member
        </h3>

        <div className="space-y-4">
          {contributors.map((contributor) => (
            <div
              key={contributor.name}
              className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700"
            >
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {contributor.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {contributor.role}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {contributor.email}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}