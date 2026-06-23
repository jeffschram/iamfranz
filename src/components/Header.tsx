import { Link, useLocation } from "react-router-dom";

export function Header() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tight text-black"
          >
            IAMFRANZ
          </Link>

          <nav className="flex space-x-6">
            <Link
              to="/how-it-works"
              className={`text-xs font-medium transition-colors ${
                isActive("/how-it-works")
                  ? "text-black border-b-2 border-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              HOW IT WORKS
            </Link>
            <Link
              to="/artist-mission"
              className={`text-xs font-medium transition-colors ${
                isActive("/artist-mission")
                  ? "text-black border-b-2 border-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              ARTIST MISSION
            </Link>
            <Link
              to="/evolution"
              className={`text-xs font-medium transition-colors ${
                isActive("/evolution")
                  ? "text-black border-b-2 border-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              EVOLUTION
            </Link>
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
              to="/full"
              className={`text-xs font-medium transition-colors ${
                isActive("/full")
                  ? "text-black border-b-2 border-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              FULL
            </Link>
            <Link
              to="/cycle"
              className={`text-xs font-medium transition-colors ${
                isActive("/cycle")
                  ? "text-black border-b-2 border-black"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              CYCLE
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
          </nav>
        </div>
      </div>
    </header>
  );
}
