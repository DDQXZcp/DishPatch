import { useState, useEffect } from "react";
import Select from "react-select";
import { EventInput } from "@fullcalendar/core";
import { Modal } from "../../components/ui/modal";
import { useModal } from "../../hooks/useModal";
import PageMeta from "../../components/common/PageMeta";
import SemesterHeaderToolbar from "./SemesterHeaderToolbar";
import GraduationRequirementTable from "./GraduationRequirementTable";

interface Course {
  courseCode: string;
  name: string;
  availability: string;
  prerequisites: string[];
  isLevel8: boolean;
  credit: number;
}

interface CalendarEvent extends EventInput {
  extendedProps: {
    calendar: string;
    courseCode?: string;
  };
}

interface RequirementStatus {
  requirement: string;
  met: boolean;
}

const SemesterPlanner: React.FC = () => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [semester, setSemester] = useState(1);
  const [selectedGridIdx, setSelectedGridIdx] = useState<number | null>(null);
  const [gridEvents, setGridEvents] = useState<{ [key: number]: CalendarEvent }>({});
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventLevel, setEventLevel] = useState("Success");
  const [courseOptions, setCourseOptions] = useState<{ label: string; value: string }[]>([]);
  const [courseMap, setCourseMap] = useState<{ [code: string]: Course }>({});
  const [requirementResults, setRequirementResults] = useState<RequirementStatus[]>([]);

  const { isOpen, openModal, closeModal } = useModal();

  const calendarsEvents = {
    Danger: "danger",
    Success: "success",
    Primary: "primary",
    Warning: "warning",
  };

  useEffect(() => {
    const api = import.meta.env.VITE_API_URL;
    fetch(`${api}/api/course`)
      .then((res) => res.json())
      .then((data: Course[]) => {
        const options = data.map((course) => ({
          label: `${course.courseCode} ${course.name}`,
          value: course.courseCode,
        }));
        const map: { [code: string]: Course } = {};
        data.forEach((course) => {
          map[course.courseCode] = course;
        });
        setCourseOptions(options);
        setCourseMap(map);
      })
      .catch((err) => console.error("Failed to fetch courses:", err));
  }, []);

  const calculateSemesterCredits = (semesterIdx: number, excludeIdx?: number, excludeCode?: string) => {
    let total = 0;
    for (let i = 0; i < 4; i++) {
      const idx = semesterIdx + i * 4;
      if (idx === excludeIdx) continue;
      const code = gridEvents[idx]?.extendedProps?.courseCode;
      if (code && code !== excludeCode) {
        total += courseMap[code]?.credit || 0;
      }
    }
    return total;
  };

  const updateRequirements = (courses: string[]) => {
    const api = import.meta.env.VITE_API_URL;
    fetch(`${api}/api/course/requirements/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseCodes: courses }),
    })
      .then((res) => res.json())
      .then((data: RequirementStatus[]) => setRequirementResults(data))
      .catch((err) => console.error("Failed to check requirements:", err));
  };

  const handleAddOrUpdateEvent = () => {
    if (selectedGridIdx === null || !eventTitle) return;

    const newCourseCode = eventTitle.split(" ")[0];
    const newCredit = courseMap[newCourseCode]?.credit || 0;
    const semesterCol = selectedGridIdx % 4;

    const existingIdx = Object.entries(gridEvents).find(([_, e]) => e.extendedProps?.courseCode === newCourseCode)?.[0];
    const updatedEvents = { ...gridEvents };
    if (existingIdx !== undefined) delete updatedEvents[parseInt(existingIdx)];

    const currentCredits = calculateSemesterCredits(semesterCol, selectedGridIdx, newCourseCode);
    if (currentCredits + newCredit > 24) {
      alert("Cannot add course: exceeds 24-credit limit for this semester.");
      return;
    }

    updatedEvents[selectedGridIdx] = {
      id: Date.now().toString(),
      title: eventTitle,
      start: "",
      end: "",
      allDay: true,
      extendedProps: {
        calendar: eventLevel,
        courseCode: newCourseCode,
      },
    };

    setGridEvents(updatedEvents);
    setSelectedGridIdx(null);
    updateRequirements(Object.values(updatedEvents).map((e) => e.extendedProps?.courseCode || ""));
    closeModal();
    resetModalFields();
  };

  const resetModalFields = () => {
    setEventTitle("");
    setEventLevel("Success");
    setSelectedEvent(null);
  };

  const handleLoadExample = () => {
    const exampleCourses = [
      { code: "COMP6710", gridIdx: 0 },
      { code: "COMP6250", gridIdx: 1 },
      { code: "COMP6442", gridIdx: 4 },
      { code: "COMP8260", gridIdx: 5 },
      { code: "COMP8830", gridIdx: 2 },
    ];

    const updatedEvents: { [key: number]: CalendarEvent } = {};
    const totalCredits = [0, 0, 0, 0];

    for (const { code, gridIdx } of exampleCourses) {
      const course = courseMap[code];
      if (!course) continue;

      const col = gridIdx % 4;
      if (totalCredits[col] + course.credit > 24) {
        alert(`Cannot add ${code}: exceeds 24-credit limit for semester ${col + 1}`);
        continue;
      }

      updatedEvents[gridIdx] = {
        id: `${Date.now()}-${code}`,
        title: `${code} ${course.name}`,
        start: "",
        end: "",
        allDay: true,
        extendedProps: {
          calendar: "Success",
          courseCode: code,
        },
      };
      totalCredits[col] += course.credit;
    }

    setGridEvents(updatedEvents);
    const addedCodes = Object.values(updatedEvents).map((e) => e.extendedProps?.courseCode || "");
    updateRequirements(addedCodes);
  };

  return (
    <>
      <PageMeta title="GradTrack Planner" description="Plan your courses by semester" />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="p-6">
          <SemesterHeaderToolbar
            year={currentYear}
            onPrevYear={() => setCurrentYear((y) => y - 1)}
            onNextYear={() => setCurrentYear((y) => y + 1)}
            semester={semester}
            onChangeSemester={setSemester}
            onLoadExample={handleLoadExample}
          />

          <div className="grid grid-cols-4 text-center text-sm text-gray-500 font-medium border-b border-gray-200 dark:border-gray-700 mb-2">
            <div className="py-2">Semester 1</div>
            <div className="py-2">Semester 2</div>
            <div className="py-2">Semester 3</div>
            <div className="py-2">Semester 4</div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[...Array(16)].map((_, idx) => (
              <div
                key={idx}
                className="h-28 border border-gray-200 rounded-md bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 cursor-pointer p-2"
                onClick={() => {
                  resetModalFields();
                  setSelectedGridIdx(idx);
                  openModal();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (gridEvents[idx]) {
                    // Remove the course from this cell
                    const updatedEvents = { ...gridEvents };
                    delete updatedEvents[idx];
                    setGridEvents(updatedEvents);
                    // Optionally update requirements if needed
                    updateRequirements(Object.values(updatedEvents).map((e) => e.extendedProps?.courseCode || ""));
                  }
                }}
                title="Right click to delete course"
              >
                {gridEvents[idx]?.title && (
                  <div className="text-sm bg-green-100 text-green-700 p-1 rounded">
                    {gridEvents[idx].title}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <GraduationRequirementTable statuses={requirementResults} />
          </div>
        </div>

        <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] p-6 lg:p-10">
          <div className="flex flex-col px-2 custom-scrollbar">
            <div>
              <h5 className="mb-2 font-semibold text-gray-800 text-theme-xl dark:text-white/90 lg:text-2xl">
                {selectedGridIdx !== null && gridEvents[selectedGridIdx] ? "Edit Course" : "Add Course"}
              </h5>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You can Select a course from the dropdown and click 'Add'. You can also search by course code or name.
              </p>
            </div>

            <div className="mt-8">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                Select a Course
              </label>
              <Select
                className="dark:text-black"
                options={courseOptions}
                onChange={(selected) => selected && setEventTitle(selected.label)}
                placeholder="Search by course code or name"
              />
            </div>

            {/* <div className="mt-6">
              <label className="block mb-4 text-sm font-medium text-gray-700 dark:text-gray-400">
                Event Color
              </label>
              <div className="flex flex-wrap items-center gap-4 sm:gap-5">
                {Object.entries(calendarsEvents).map(([key, value]) => (
                  <div key={key} className="n-chk">
                    <div className={`form-check form-check-${value} form-check-inline`}>
                      <label
                        className="flex items-center text-sm text-gray-700 form-check-label dark:text-gray-400"
                        htmlFor={`modal${key}`}
                      >
                        <span className="relative">
                          <input
                            className="sr-only form-check-input"
                            type="radio"
                            name="event-level"
                            value={key}
                            id={`modal${key}`}
                            checked={eventLevel === key}
                            onChange={() => setEventLevel(key)}
                          />
                          <span className="flex items-center justify-center w-5 h-5 mr-2 border border-gray-300 rounded-full box dark:border-gray-700">
                            <span className={`h-2 w-2 rounded-full bg-white ${eventLevel === key ? "block" : "hidden"}`}></span>
                          </span>
                        </span>
                        {key}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div> */}

            <div className="flex items-center gap-3 mt-6 sm:justify-end">
              <button
                onClick={closeModal}
                type="button"
                className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] sm:w-auto"
              >
                Close
              </button>
              <button
                onClick={handleAddOrUpdateEvent}
                type="button"
                className="btn btn-success flex w-full justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 sm:w-auto"
              >
                {selectedEvent ? "Update Changes" : "Add Course"}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
};

export default SemesterPlanner;