import React from 'react';
import Layout from '../components/common/Layout';
import Card from '../components/common/Card';
import { Mic, Activity, Brain, Info, ArrowRight, Puzzle, Waves, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
    const modules = [
        {
            title: "Full Diagnostic Suite",
            desc: "Run all clinical tests in sequence and generate a comprehensive PDF report.",
            path: "/full-assessment",
            icon: ClipboardList,
            color: "bg-park-navy text-white" // Special styling handled in map
        },
        {
            title: "Vocal Motor Test",
            desc: "Analyze voice tremors, jitter, and phonation time.",
            path: "/vocal-test",
            icon: Mic,
            color: "bg-blue-50 text-blue-600"
        },
        {
            title: "Resting Tremor",
            desc: "Real-time detection of resting tremors (4-6Hz) vs voluntary movement.",
            path: "/tremor-test",
            icon: Waves,
            color: "bg-teal-50 text-teal-600"
        },
        {
            title: "Rapid Tap Test",
            desc: "Measure bradykinesia and motor fatigue speed.",
            path: "/tap-test",
            icon: Activity,
            color: "bg-green-50 text-green-600"
        },
        {
            title: "Dual-Task Stress",
            desc: "Evaluate cognitive-motor interference levels.",
            path: "/dual-task",
            icon: Brain,
            color: "bg-purple-50 text-purple-600"
        },
        {
            title: "Stroop Interference",
            desc: "Measure cognitive flexibility and inhibition.",
            path: "/cognitive-test",
            icon: Puzzle,
            color: "bg-red-50 text-red-600"
        },
        {
            title: "Lifestyle Guide",
            desc: "Environmental safety and symptom management tips.",
            path: "/lifestyle",
            icon: Info,
            color: "bg-orange-50 text-orange-600"
        }
    ];

    const heroModule = modules[0];
    const standardModules = modules.slice(1);

    return (
        <Layout>
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-park-navy mb-4 tracking-tight">
                        Welcome to <span className="text-park-sage font-branding">neurolife</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Your companion for monitoring neurological health and optimizing your living environment.
                    </p>
                </div>

                {/* Compact Hero Card */}
                <Link to={heroModule.path} className="block mb-10 group">
                    <Card className="!bg-park-navy hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 !border-none relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>

                        <div className="flex flex-col md:flex-row items-center p-1">
                            <div className="p-4 rounded-xl bg-white/10 text-white mb-4 md:mb-0 md:mr-6 shrink-0">
                                <heroModule.icon size={32} />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-bold text-white mb-1">
                                    {heroModule.title}
                                </h3>
                                <p className="text-white/80 text-base">
                                    {heroModule.desc}
                                </p>
                            </div>
                            <div className="mt-4 md:mt-0 md:ml-6 p-3 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors shrink-0">
                                <ArrowRight className="text-white w-6 h-6" />
                            </div>
                        </div>
                    </Card>
                </Link>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                    {standardModules.map((m) => {
                        const Icon = m.icon;
                        return (
                            <Link to={m.path} key={m.title} className="group">
                                <Card className="h-full !bg-park-sage hover:bg-opacity-90 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 !border-none">
                                    <div className="flex items-start justify-between">
                                        <div className={`p-4 rounded-2xl bg-white/20 text-white mb-6`}>
                                            <Icon size={40} />
                                        </div>
                                        <ArrowRight className="text-white/50 group-hover:text-white transition-colors" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-3">
                                        {m.title}
                                    </h3>
                                    <p className="text-lg text-white/80 leading-relaxed">
                                        {m.desc}
                                    </p>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;
