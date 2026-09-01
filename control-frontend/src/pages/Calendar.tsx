import PageMeta from "../components/common/PageMeta";
import SemesterPlanner from "../components/tables/SemesterPlanner";
import Alert from "../components/ui/alert/Alert";

const Calendar: React.FC = () => {
  return (
    <>
      <PageMeta title="React.js Calendar Dashboard" description="Planner page" />
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        Semester Planner
      </h3>
      <Alert
        variant="info"
        title="User Guide"
        message="Add Course: Click on a grid cell to add a course. Select a course from the dropdown and click 'Add'. | Remove Course: Right-click on a grid cell to remove a course. | Load Sample: Click Load Example to load sample data."
        showLink={true}
        linkHref="/"
        linkText="Learn more"
      />
      <div className="mb-6" />
      <SemesterPlanner />
    </>
  );
};

export default Calendar;
