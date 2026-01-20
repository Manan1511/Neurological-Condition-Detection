import React from 'react';
import Layout from '../components/common/Layout';
import Card from '../components/common/Card';
import { Sun, Palette, GripHorizontal, LayoutGrid, Eye } from 'lucide-react';

const Lifestyle = () => {
    const tips = [
        {
            title: "Lighting & Visibility",
            icon: Sun,
            color: 'text-yellow-500',
            content: "Dim lighting can trigger hallucinations or freezing. Ensure rooms are brightly and evenly lit. Use night lights in hallways."
        },
        {
            title: "Color Psychology",
            icon: Palette,
            color: 'text-park-sage',
            content: "Use calming blues and greens (like this app) to reduce anxiety-induced tremors. Avoid bright reds or chaotic patterns."
        },
        {
            title: "High Contrast",
            icon: Eye,
            color: 'text-park-navy',
            content: "Use high contrast to help with depth perception. For example, a dark toilet seat on a white bowl, or colored tape on stair edges."
        },
        {
            title: "Flooring & Pathways",
            icon: GripHorizontal,
            color: 'text-orange-500',
            content: "Remove loose rugs and clutter. Use non-slip textures. Visual cues (like strips of tape on the floor) can help break freezing episodes."
        },
        {
            title: "De-Cluttering",
            icon: LayoutGrid,
            color: 'text-indigo-500',
            content: "Keep pathways wide and clear. Simplify furniture arrangements to allow for easy turning and maneuvering."
        }
    ];

    return (
        <Layout>
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-park-navy mb-4">Lifestyle & Safety Guide</h1>
                    <p className="text-xl text-gray-600">
                        Environmental modifications to reduce freezing, anxiety, and fall risk.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {tips.map((tip, index) => {
                        const Icon = tip.icon;
                        return (
                            <Card key={index} className="hover:shadow-xl transition-shadow duration-300">
                                <div className="flex items-start">
                                    <div className={`p-3 rounded-xl bg-gray-50 mr-4 ${tip.color}`}>
                                        <Icon size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-park-navy mb-2">{tip.title}</h3>
                                        <p className="text-gray-600 leading-relaxed">
                                            {tip.content}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </Layout>
    );
};

export default Lifestyle;
