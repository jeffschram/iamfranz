import { Link, useLocation } from "react-router-dom";

export function Header() {
  const location = useLocation();
  const isLocalAdminVisible =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  
  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-xl font-semibold tracking-tight text-black">
            IAMFRANZ
          </Link>
          
          <nav className="flex space-x-6">
            <Link
              to="/archive"
              className={`text-xs font-medium transition-colors ${
                isActive("/archive")
                  ? "text-black border-b-2 border-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              ARCHIVE
            </Link>
            <Link
              to="/about"
              className={`text-xs font-medium transition-colors ${
                isActive("/about")
                  ? "text-black border-b-2 border-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              ABOUT
            </Link>
            {/* <Link
              to="/process"
              className={`text-xs font-medium transition-colors ${
                isActive("/process")
                  ? "text-black border-b-2 border-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              PROCESS
            </Link> */}
            {isLocalAdminVisible ? (
              <Link
                to="/admin"
                className={`text-xs font-medium transition-colors ${
                  isActive("/admin")
                    ? "text-black border-b-2 border-black"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                ADMIN
              </Link>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}
