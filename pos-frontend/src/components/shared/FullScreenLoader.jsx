import JinmaoLogo from "../../assets/images/Jinmao.png";

const FullScreenLoader = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="relative">
        {/* Spinner */}
        <div
          className="
            h-20 w-20
            animate-spin
            rounded-full
            border-4
            border-border
            border-t-primary
          "
        />

        {/* Logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={JinmaoLogo}
            alt="Loading"
            draggable={false}
            className="h-10 w-10 select-none object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default FullScreenLoader;