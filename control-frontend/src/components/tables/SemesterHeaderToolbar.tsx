import Button from "../../components/ui/button/Button";
import { BoxIcon } from "../../icons";

interface Props {
  year: number;
  onPrevYear: () => void;
  onNextYear: () => void;
  semester: number;
  onChangeSemester: (semester: number) => void;
  onLoadExample: () => void; // added prop
}

const SemesterHeaderToolbar: React.FC<Props> = ({
  year,
  onPrevYear,
  onNextYear,
  semester,
  onChangeSemester,
  onLoadExample,
}) => {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 rounded-t-2xl">
      {/* Left Section */}
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onPrevYear}
        >
          Prev Year
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onNextYear}
        >
          Next Year
        </Button>
        <Button
          size="sm"
          variant="primary"
          startIcon={<BoxIcon className="size-5" />}
          onClick={onLoadExample}
        >
          Load Example 1
        </Button>
      </div>

      {/* Center Section */}
      <div className="text-lg font-semibold text-gray-800 dark:text-white">
        Start Semester: {year}S{semester}
      </div>

      {/* Right Section */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
        {[1, 2].map((s) => (
          <Button
            size="sm"
            variant={semester === s ? "primary" : "outline"}
            key={s}
            onClick={() => onChangeSemester(s)}
          >
            Semester {s}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default SemesterHeaderToolbar;