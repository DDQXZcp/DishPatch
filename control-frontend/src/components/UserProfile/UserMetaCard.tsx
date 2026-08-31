export interface UserMetaCardProps {
  name: string;
  role: string;
  location: string;
  linkedinUrl: string;
  avatarUrl?: string;
  githubUrl?: string;
}

const DEFAULT_GITHUB_URL = "https://github.com/DDQXZcp/DishPatch/";

export default function UserMetaCard({
  name,
  role,
  location,
  linkedinUrl,
  avatarUrl,
  githubUrl = DEFAULT_GITHUB_URL,
}: UserMetaCardProps) {
  // Contributors without a personal profile fall back to the repository, so
  // the link has to describe whichever one it actually points at.
  const isRepoLink = githubUrl === DEFAULT_GITHUB_URL;

  return (
    <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md lg:p-6">
      <div className="flex flex-col items-center gap-5 xl:flex-row">
        {/* User avatar */}
        {avatarUrl ? (
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-brand-border bg-brand-light">
            <img
              src={avatarUrl}
              alt={`${name} profile`}
              className={`h-full w-full ${
                avatarUrl === "/images/ANU_Crest_Inversed_Gold.png"
                  ? "object-contain p-4"
                  : "object-cover"
              }`}
            />
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-light text-brand">
            <svg
              width="38"
              height="38"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d="M5 20C5.62765 16.9783 8.27832 15 12 15C15.7217 15 18.3724 16.9783 19 20"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* User information */}
        <div className="min-w-0 flex-1 text-center xl:text-left">
          <h4 className="mb-2 truncate text-lg font-semibold text-gray-800">
            {name}
          </h4>

          <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
            <p className="text-sm text-gray-500">{role}</p>

            <div className="hidden h-3.5 w-px bg-brand-border xl:block" />

            <p className="text-sm text-gray-500">{location}</p>
          </div>
        </div>

        {/* Social links */}
        <div className="flex shrink-0 items-center gap-2">
          {/* LinkedIn */}
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${name}'s LinkedIn profile`}
            title={`${name}'s LinkedIn`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-border bg-white text-brand shadow-sm transition-all duration-200 hover:border-brand hover:bg-brand-light hover:text-brand-hover focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <svg
              className="fill-current"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M5.78381 4.16645C5.78351 4.84504 5.37181 5.45569 4.74286 5.71045C4.11391 5.96521 3.39331 5.81321 2.92083 5.32613C2.44836 4.83904 2.31837 4.11413 2.59216 3.49323C2.86596 2.87233 3.48886 2.47942 4.16715 2.49978C5.06804 2.52682 5.78422 3.26515 5.78381 4.16645ZM5.83381 7.06645H2.50048V17.4998H5.83381V7.06645ZM11.1005 7.06645H7.78381V17.4998H11.0672V12.0248C11.0672 8.97475 15.0422 8.69142 15.0422 12.0248V17.4998H18.3338V10.8914C18.3338 5.74978 12.4505 5.94145 11.0672 8.46642L11.1005 7.06645Z" />
            </svg>
          </a>

          {/* GitHub */}
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={
              isRepoLink
                ? "Open the DishPatch GitHub repository"
                : `Open ${name}'s GitHub profile`
            }
            title={isRepoLink ? "DishPatch GitHub repository" : `${name}'s GitHub`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-border bg-white text-brand shadow-sm transition-all duration-200 hover:border-brand hover:bg-brand-light hover:text-brand-hover focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <svg
              className="fill-current"
              width="21"
              height="21"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M12 2C6.477 2 2 6.589 2 12.253C2 16.784 4.865 20.629 8.839 21.987C9.339 22.082 9.521 21.765 9.521 21.493C9.521 21.249 9.512 20.604 9.507 19.748C6.725 20.367 6.138 18.373 6.138 18.373C5.683 17.188 5.027 16.873 5.027 16.873C4.119 16.236 5.096 16.249 5.096 16.249C6.1 16.322 6.628 17.307 6.628 17.307C7.52 18.874 8.968 18.421 9.539 18.159C9.63 17.496 9.888 17.044 10.174 16.787C7.953 16.528 5.62 15.649 5.62 11.72C5.62 10.601 6.01 9.686 6.649 8.968C6.546 8.709 6.203 7.667 6.747 6.255C6.747 6.255 7.586 5.98 9.497 7.306C10.294 7.079 11.15 6.965 12 6.961C12.85 6.965 13.706 7.079 14.505 7.306C16.415 5.98 17.253 6.255 17.253 6.255C17.798 7.667 17.455 8.709 17.352 8.968C17.992 9.686 18.379 10.601 18.379 11.72C18.379 15.659 16.043 16.525 13.815 16.779C14.174 17.096 14.494 17.723 14.494 18.682C14.494 20.056 14.482 21.164 14.482 21.493C14.482 21.768 14.662 22.087 15.171 21.986C19.141 20.625 22 16.782 22 12.253C22 6.589 17.523 2 12 2Z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}