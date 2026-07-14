import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

// Assume these icons are imported from an icon library
import {
  BoxCubeIcon,
  // CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  // ListIcon,
  // PageIcon,
  PieChartIcon,
  PlugInIcon,
  // TableIcon,
  UserCircleIcon,
  GroupIcon,
} from "../icons";

import { useSidebar } from "../context/SidebarContext";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: {
    name: string;
    path: string;
    pro?: boolean;
    new?: boolean;
  }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Robot Control Dashboard",
    path: "/",
    // subItems: [{ name: "Ecommerce", path: "/", pro: false }],
  },
  // {
  //   icon: <CalenderIcon />,
  //   name: "GradTrack Planner",
  //   path: "/calendar",
  // },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/profile",
  },
  {
    icon: <GroupIcon />,
    name: "Contributors",
    path: "/contributors",
  },
  // {
  //   name: "Forms",
  //   icon: <ListIcon />,
  //   subItems: [{ name: "Form Elements", path: "/form-elements", pro: false }],
  // },
  // {
  //   name: "Tables",
  //   icon: <TableIcon />,
  //   subItems: [{ name: "Basic Tables", path: "/basic-tables", pro: false }],
  // },
  // {
  //   name: "Pages",
  //   icon: <PageIcon />,
  //   subItems: [
  //     { name: "Blank Page", path: "/blank", pro: false },
  //     { name: "404 Error", path: "/error-404", pro: false },
  //   ],
  // },
];

const othersItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Charts",
    subItems: [
      {
        name: "Line Chart",
        path: "/line-chart",
        pro: false,
      },
      {
        name: "Bar Chart",
        path: "/bar-chart",
        pro: false,
      },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "UI Elements",
    subItems: [
      {
        name: "Alerts",
        path: "/alerts",
        pro: false,
      },
      {
        name: "Avatar",
        path: "/avatars",
        pro: false,
      },
      {
        name: "Badge",
        path: "/badge",
        pro: false,
      },
      {
        name: "Buttons",
        path: "/buttons",
        pro: false,
      },
      {
        name: "Images",
        path: "/images",
        pro: false,
      },
      {
        name: "Videos",
        path: "/videos",
        pro: false,
      },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Authentication",
    subItems: [
      {
        name: "Sign In",
        path: "/signin",
        pro: false,
      },
      {
        name: "Sign Up",
        path: "/signup",
        pro: false,
      },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const {
    isExpanded,
    isMobileOpen,
    isHovered,
    setIsHovered,
  } = useSidebar();

  const location = useLocation();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);

  const [subMenuHeight, setSubMenuHeight] = useState<
    Record<string, number>
  >({});

  const subMenuRefs = useRef<
    Record<string, HTMLDivElement | null>
  >({});

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  useEffect(() => {
    let submenuMatched = false;

    ["main", "others"].forEach((menuType) => {
      const items =
        menuType === "main" ? navItems : othersItems;

      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });

              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;

      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]:
            subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (
    index: number,
    menuType: "main" | "others"
  ) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }

      return {
        type: menuType,
        index,
      };
    });
  };

  const renderMenuItems = (
    items: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => {
        const isSubmenuOpen =
          openSubmenu?.type === menuType &&
          openSubmenu.index === index;

        return (
          <li key={nav.name}>
            {nav.subItems ? (
              <button
                type="button"
                onClick={() =>
                  handleSubmenuToggle(index, menuType)
                }
                className={`menu-item group cursor-pointer ${
                  isSubmenuOpen
                    ? "bg-brand-light text-brand-hover"
                    : "text-gray-600 hover:bg-brand-light hover:text-brand-hover"
                } ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "lg:justify-start"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isSubmenuOpen
                      ? "text-brand"
                      : "text-gray-400 group-hover:text-brand"
                  }`}
                >
                  {nav.icon}
                </span>

                {(isExpanded ||
                  isHovered ||
                  isMobileOpen) && (
                  <span className="menu-item-text">
                    {nav.name}
                  </span>
                )}

                {(isExpanded ||
                  isHovered ||
                  isMobileOpen) && (
                  <ChevronDownIcon
                    className={`ml-auto h-5 w-5 transition-transform duration-200 ${
                      isSubmenuOpen
                        ? "rotate-180 text-brand"
                        : "text-gray-400 group-hover:text-brand"
                    }`}
                  />
                )}
              </button>
            ) : (
              nav.path && (
                <Link
                  to={nav.path}
                  className={`menu-item group ${
                    isActive(nav.path)
                      ? "bg-brand-light text-brand-hover"
                      : "text-gray-600 hover:bg-brand-light hover:text-brand-hover"
                  }`}
                >
                  <span
                    className={`menu-item-icon-size ${
                      isActive(nav.path)
                        ? "text-brand"
                        : "text-gray-400 group-hover:text-brand"
                    }`}
                  >
                    {nav.icon}
                  </span>

                  {(isExpanded ||
                    isHovered ||
                    isMobileOpen) && (
                    <span className="menu-item-text">
                      {nav.name}
                    </span>
                  )}
                </Link>
              )
            )}

            {nav.subItems &&
              (isExpanded ||
                isHovered ||
                isMobileOpen) && (
                <div
                  ref={(element) => {
                    subMenuRefs.current[
                      `${menuType}-${index}`
                    ] = element;
                  }}
                  className="overflow-hidden transition-all duration-300"
                  style={{
                    height: isSubmenuOpen
                      ? `${
                          subMenuHeight[
                            `${menuType}-${index}`
                          ]
                        }px`
                      : "0px",
                  }}
                >
                  <ul className="ml-9 mt-2 space-y-1">
                    {nav.subItems.map((subItem) => (
                      <li key={subItem.name}>
                        <Link
                          to={subItem.path}
                          className={`menu-dropdown-item ${
                            isActive(subItem.path)
                              ? "bg-brand-light text-brand-hover"
                              : "text-gray-500 hover:bg-brand-light hover:text-brand-hover"
                          }`}
                        >
                          {subItem.name}

                          <span className="ml-auto flex items-center gap-1">
                            {subItem.new && (
                              <span
                                className={`menu-dropdown-badge ml-auto ${
                                  isActive(subItem.path)
                                    ? "bg-brand text-white"
                                    : "bg-brand-light text-brand"
                                }`}
                              >
                                new
                              </span>
                            )}

                            {subItem.pro && (
                              <span
                                className={`menu-dropdown-badge ml-auto ${
                                  isActive(subItem.path)
                                    ? "bg-brand text-white"
                                    : "bg-brand-light text-brand"
                                }`}
                              >
                                pro
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside
      className={`fixed left-0 top-0 z-50 mt-16 flex h-screen flex-col overflow-hidden border-r border-brand-border bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out lg:mt-0
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
              ? "w-[290px]"
              : "w-[90px]"
        }
        ${
          isMobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }
        lg:translate-x-0`}
      onMouseEnter={() =>
        !isExpanded && setIsHovered(true)
      }
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Bottom background image */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%]">
        <img
          src="/images/ANU_Hive.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-100"
        />

        {/* Smooth fade from white into the image */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/70 to-transparent" />
      </div>

      {/* Logo */}
      <div
        className={`relative z-10 flex py-8 ${
          !isExpanded && !isHovered
            ? "lg:justify-center"
            : "justify-center"
        }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <img
              src="/images/logo/dishpatch-light.svg"
              alt="DishPatch Logo"
              width={240}
              height={40}
            />
          ) : (
            <img
              src="/images/logo/dishpatch-light-no-text.svg"
              alt="DishPatch Logo"
              width={64}
              height={64}
            />
          )}
        </Link>
      </div>

      {/* Navigation */}
      <div className="no-scrollbar relative z-10 flex flex-1 flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 flex text-xs uppercase leading-[20px] text-brand ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>

              {renderMenuItems(navItems, "main")}
            </div>

            {/*
            <div>
              <h2
                className={`mb-4 flex text-xs uppercase leading-[20px] text-brand ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>

              {renderMenuItems(othersItems, "others")}
            </div>
            */}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;