import React from 'react';
import { Home, Activity, Mic, Brain, Info, Menu, X, Palette } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    // Close menu when route changes
    React.useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const navItems = [
        { name: 'Dashboard', path: '/', icon: Home },
        { name: 'Vocal Test', path: '/vocal-test', icon: Mic },
        { name: 'Tap Test', path: '/tap-test', icon: Activity },
        { name: 'Dual Task', path: '/dual-task', icon: Brain },
        { name: 'Stroop Color Word Test', path: '/cognitive-test', icon: Palette },
        { name: 'Lifestyle', path: '/lifestyle', icon: Info },
    ];

    return (
        <div className="min-h-screen bg-park-bg font-sans text-park-charcoal">
            <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20">
                        <div className="flex">
                            <Link to="/" className="flex-shrink-0 flex items-center">
                                <span className="font-bold text-2xl text-park-sage tracking-tight font-branding">NeuroLife</span>
                            </Link>
                        </div>

                        <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.path}
                                        className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 ease-in-out ${isActive
                                            ? 'bg-park-sage text-white shadow-md transform scale-105'
                                            : 'text-gray-500 hover:bg-park-sage/10 hover:text-park-sage hover:shadow-sm'
                                            }`}
                                    >
                                        <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-park-sage'}`} />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="flex items-center sm:hidden">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-park-sage"
                                aria-expanded="false"
                            >
                                <span className="sr-only">Open main menu</span>
                                {isMobileMenuOpen ? (
                                    <X className="block h-8 w-8 text-park-navy" aria-hidden="true" />
                                ) : (
                                    <Menu className="block h-8 w-8 text-park-navy" aria-hidden="true" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Overlay */}
                <div
                    className={`sm:hidden transition-all duration-300 ease-in-out origin-top transform ${isMobileMenuOpen ? 'opacity-100 scale-y-100 max-h-screen' : 'opacity-0 scale-y-0 max-h-0'
                        } overflow-hidden bg-white border-b border-gray-200 shadow-lg`}
                >
                    <div className="pt-2 pb-4 space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    className={`flex items-center pl-3 pr-4 py-3 border-l-4 text-lg font-medium transition-colors duration-200 ${isActive
                                        ? 'bg-park-bg border-park-sage text-park-navy'
                                        : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                                        }`}
                                >
                                    <Icon className={`w-6 h-6 mr-3 ${isActive ? 'text-park-sage' : 'text-gray-400'}`} />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                {children}
            </main>

            <footer className="bg-white border-t border-gray-200 py-8 mt-12">
                <div className="max-w-7xl mx-auto px-4 text-center text-gray-500">
                    <p>© 2026 <span className="font-branding">NeuroLife</span>. Designed for Accessibility.</p>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
