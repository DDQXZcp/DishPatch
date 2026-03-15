import { useEffect, useState } from "react";

type Requirement = {
  requirement: string;
  requiredCourses: string;
  credits: number;
};

type RequirementStatus = {
  requirement: string;
  met: boolean;
};

const GraduationRequirementTable: React.FC<{ statuses: RequirementStatus[] }> = ({ statuses }) => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);

  useEffect(() => {
    const api = import.meta.env.VITE_API_URL;
    fetch(`${api}/api/course/requirements`)
      .then((res) => res.json())
      .then((data) => setRequirements(data))
      .catch((err) => console.error("Failed to fetch requirements:", err));
  }, []);

  const getStatus = (reqId: string) => {
    const match = statuses.find((s) => s.requirement === reqId);
    return match?.met ? "Met" : "Not Met";
  };

  const getBadgeStyle = (status: string) =>
    status === "Met"
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-800";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
        <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            <th className="px-6 py-3">Requirement ID</th>
            <th className="px-6 py-3">Required Courses</th>
            <th className="px-6 py-3">Credits</th>
            <th className="px-6 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {requirements.map((req, idx) => {
            const status = getStatus(req.requirement) ?? "Not Met";
            return (
              <tr key={idx} className="border-b bg-white dark:border-gray-700 dark:bg-gray-900">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                  {req.requirement}
                </td>
                <td className="px-6 py-4 whitespace-pre-line">{req.requiredCourses}</td>
                <td className="px-6 py-4">{req.credits}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeStyle(status)}`}>
                    {status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default GraduationRequirementTable;