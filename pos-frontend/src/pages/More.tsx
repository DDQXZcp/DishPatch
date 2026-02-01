import React, { useEffect } from "react";
import BottomNav from "../components/shared/BottomNav";
import BackButton from "../components/shared/BackButton";
import { FaUserCircle, FaUtensils } from "react-icons/fa";
import { MdEmail, MdPhone } from "react-icons/md";

const More: React.FC = () => {
  useEffect(() => {
    document.title = "POS | Profile";

    // ✅ Dynamically load LinkedIn script once
    const script = document.createElement("script");
    script.src = "https://platform.linkedin.com/badges/js/profile.js";
    script.async = true;
    script.defer = true;
    script.type = "text/javascript";
    document.body.appendChild(script);

    return () => {
      // Optional cleanup: remove the script if component unmounts
      document.body.removeChild(script);
    };
  }, []);

  const user = {
    name: "Lisi Chen",
    role: "Administrator",
    email: "lisi.chen@example.com",
    phone: "+61 400 123 456",
    location: "Canberra, ACT",
  };

  return (
    <section className="bg-[#1f1f1f] h-[calc(100vh-5rem)] overflow-hidden flex gap-3">
      {/* Left Side */}
      <div className="flex-[3] flex flex-col px-10 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
            <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
              Profile
            </h1>
        </div>

        {/* ✅ LinkedIn Profile Card */}
        <div className="badge-base LI-profile-badge" 
            data-locale="en_US" 
            data-size="large" 
            data-theme="light" 
            data-type="HORIZONTAL" 
            data-vanity="herman-tang" 
            data-version="v1">
            {/* <a className="badge-base__link LI-simple-link" 
                href="https://au.linkedin.com/in/herman-tang?trk=profile-badge">Herman Tang
            </a> */}
        </div>
      </div>
{/* 
      Right Side Placeholder
      <div className="flex-[2]" /> */}

      {/* Bottom Navigation */}
      <BottomNav />
    </section>
  );
};

export default More;