import React from 'react';
import Layout from '../components/common/Layout';
import Card from '../components/common/Card';
import { Mic, Activity, Brain, Info, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
    const modules = [
        {
            title: "Vocal Motor Test",
            desc: "Analyze voice tremors, jitter, and phonation time.",
            path: "/vocal-test",
            icon: Mic,
            color: "bg-blue-50 text-blue-600"
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
            title: "Cognitive Test",
            desc: "Stroop Color-Word test to measure executive function and inhibition.",
            path: "/cognitive-test",
            icon: Brain,
            color: "bg-indigo-50 text-indigo-600"
        },
        {
            title: "Lifestyle Guide",
            desc: "Environmental safety and symptom management tips.",
            path: "/lifestyle",
            icon: Info,
            color: "bg-orange-50 text-orange-600"
        }
    ];

    return (
        <Layout>
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-bold text-park-navy mb-6 tracking-tight">
                        Welcome to <span className="text-park-sage font-branding">NeuroLife</span>
                    </h1>
                    <p className="text-2xl text-gray-600 max-w-3xl mx-auto">
                        Your companion for monitoring neurological health and optimizing your living environment.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                    {modules.map((m) => {
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
