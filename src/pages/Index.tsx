import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight, CheckCircle, Brain, Calculator, FileText } from "lucide-react";

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: FileText,
      title: "Upload Lecture Notes",
      description: "Support for PDF, DOC, DOCX, PPT, and PPTX files with mathematical notation extraction.",
    },
    {
      icon: Brain,
      title: "Step-by-Step Solutions",
      description: "Get detailed, mathematically correct solutions with clear explanations for every step.",
    },
    {
      icon: Calculator,
      title: "Built-in Tools",
      description: "Scientific calculator and unit converter always at your fingertips.",
    },
  ];

  const topics = [
    "Limits & Continuity",
    "Differentiation",
    "Integration",
    "Differential Equations",
    "Linear Algebra",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg">1Note</span>
          </div>
          <Button onClick={() => navigate("/auth")}>
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-full text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-accent"></span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Your Personal
            <br />
            <span className="text-accent">Math Tutor</span>
          </h1>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Upload your lecture notes and get step-by-step solutions, 
            clear explanations, and AI-powered assistance for Engineering Mathematics I.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Start Learning
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y bg-card">
        <div className="container mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">
            Everything You Need to Master Math
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {features.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">Supported Topics</h2>
          
          <div className="flex flex-wrap justify-center gap-3">
            {topics.map((topic) => (
              <div
                key={topic}
                className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-full"
              >
                <CheckCircle className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium">{topic}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-xl mx-auto text-center bg-primary text-primary-foreground rounded-2xl p-8 md:p-12">
          <h2 className="text-2xl font-bold mb-4">
            Ready to Ace Your Math Course?
          </h2>
          <p className="text-primary-foreground/80 mb-6">
            Upload your first lecture notes and get started with personalized math tutoring.
          </p>
          <Button 
            variant="secondary" 
            size="lg"
            onClick={() => navigate("/auth")}
          >
            Get Started Free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="font-semibold">1Note</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Focused on Engineering Mathematics I. Clear solutions. No guessing.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
