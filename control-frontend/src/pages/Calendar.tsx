import { useState, useEffect } from "react";
import Select from "react-select";
import { EventInput } from "@fullcalendar/core";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";
import SemesterHeaderToolbar from "../components/tables/SemesterHeaderToolbar";
import GraduationRequirementTable from "../components/tables/GraduationRequirementTable";
import SemesterPlanner from "../components/tables/SemesterPlanner";
import Alert from "../components/ui/alert/Alert";

type Course = {
  courseCode: string;
  name: string;
  availability: string;
  prerequisites: string[];
  isLevel8: boolean;
  credit: number;
};

interface CalendarEvent extends EventInput {
  extendedProps: {
    calendar: string;
  };
}

const Calendar: React.FC = () => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [semester, setSemester] = useState(1);
  const [selectedGridIdx, setSelectedGridIdx] = useState<number | null>(null);
  const [gridEvents, setGridEvents] = useState<{ [key: number]: CalendarEvent }>({});
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventLevel, setEventLevel] = useState("Success");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [courseOptions, setCourseOptions] = useState<{ label: string; value: string }[]>([]);

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
      .then((data) => {
        console.log("Fetched courses:", data); // 👈 add this
        const options = data.map((course: Course) => ({
          label: `${course.courseCode} ${course.name}`,
          value: course.courseCode,
        }));
        setCourseOptions(options);
      })
      .catch((err) => {
        console.error("Failed to fetch courses:", err);
      });
  }, []);


  const handleAddOrUpdateEvent = () => {
    if (selectedGridIdx !== null) {
      const newEvent: CalendarEvent = {
        id: Date.now().toString(),
        title: eventTitle,
        start: "",
        end: "",
        allDay: true,
        extendedProps: { calendar: eventLevel },
      };
      setGridEvents((prev) => ({ ...prev, [selectedGridIdx]: newEvent }));
      setSelectedGridIdx(null);
    } else if (selectedEvent) {
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === selectedEvent.id
            ? {
                ...event,
                title: eventTitle,
                start: eventStartDate,
                end: eventEndDate,
                extendedProps: { calendar: eventLevel },
              }
            : event
        )
      );
    } else {
      const newEvent: CalendarEvent = {
        id: Date.now().toString(),
        title: eventTitle,
        start: eventStartDate,
        end: eventEndDate,
        allDay: true,
        extendedProps: { calendar: eventLevel },
      };
      setEvents((prevEvents) => [...prevEvents, newEvent]);
    }
    closeModal();
    resetModalFields();
  };

  const resetModalFields = () => {
    setEventTitle("");
    setEventStartDate("");
    setEventEndDate("");
    setEventLevel("Success");
    setSelectedEvent(null);
  };

  return (
    <>
      <PageMeta title="React.js Calendar Dashboard" description="Planner page" />
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Semester Planner</h3>
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