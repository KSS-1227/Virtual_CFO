import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  Zap, 
  MessageCircle, 
  FileText, 
  Play,
  Menu,
  X,
  Brain,
  IndianRupee,
  ShieldCheck,
  Smartphone
} from "lucide-react";

export function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: MessageCircle,
      title: "WhatsApp Integration",
      description: "Send photos of bills or type expenses on WhatsApp. We handle the rest instantly."
    },
    {
      icon: Brain,
      title: "AI CFO Assistant",
      description: "Get 24/7 financial advice. Ask 'How is my profit this month?' in Hindi or English."
    },
    {
      icon: FileText,
      title: "GST Compliant",
      description: "Automated GST reports and P&L statements generated in seconds, not days."
    },
    {
      icon: TrendingUp,
      title: "Business Health",
      description: "Real-time monitoring of your business score with actionable growth tips."
    }
  ];

  const stats = [
    { value: "65M+", label: "Small Businesses in India" },
    { value: "₹2.4L", label: "Avg. Annual Loss Prevented" },
    { value: "40hrs", label: "Saved Monthly on Bookkeeping" },
    { value: "60s", label: "To Get Financial Insights" }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
            {/* Logo */}
            <div className="flex items-center gap-2 font-bold text-xl cursor-pointer" onClick={() => navigate("/")}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <IndianRupee className="h-5 w-5" />
                </div>
                <span>VirtualCFO</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
                <a href="#features" className="transition-colors hover:text-primary">Features</a>
                <a href="#how-it-works" className="transition-colors hover:text-primary">How it Works</a>
                <a href="#pricing" className="transition-colors hover:text-primary">Pricing</a>
                <Button variant="ghost" onClick={() => navigate("/auth")}>Log in</Button>
                <Button onClick={() => navigate("/auth")}>Start Free Trial</Button>
            </div>

            {/* Mobile Menu Toggle */}
            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
            <div className="md:hidden border-t p-4 space-y-4 bg-background absolute w-full shadow-lg z-50">
                <a href="#features" className="block text-sm font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Features</a>
                <a href="#how-it-works" className="block text-sm font-medium py-2" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
                <a href="#pricing" className="block text-sm font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
                <div className="flex flex-col gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => navigate("/auth")}>Log in</Button>
                    <Button onClick={() => navigate("/auth")}>Start Free Trial</Button>
                </div>
            </div>
        )}
      </nav>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 md:py-32 bg-gradient-to-b from-primary/5 to-background">
            <div className="container px-4 md:px-6">
                <div className="flex flex-col items-center text-center space-y-8">
                    <Badge variant="outline" className="px-4 py-1.5 text-sm border-primary/20 bg-primary/10 text-primary animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        🚀 Trusted by 10,000+ Indian Businesses
                    </Badge>
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tighter max-w-4xl leading-tight">
                        From WhatsApp Messages to <span className="text-primary">CFO-Level Insights</span> in 60 Seconds
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Stop losing money on manual bookkeeping. VirtualCFO acts as your personal financial expert, helping you track earnings, save taxes, and grow your business.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 min-w-[200px]">
                        <Button size="lg" className="h-12 px-8 text-lg shadow-lg shadow-primary/20" onClick={() => navigate("/auth")}>
                            Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                        <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
                            <Play className="mr-2 h-5 w-5" /> Watch Demo
                        </Button>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> No credit card required • 14-day free trial • Cancel anytime
                    </p>
                </div>
            </div>
            
            {/* Abstract Background Elements */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10"></div>
            <div className="absolute top-0 right-0 translate-x-1/3 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl -z-10"></div>
        </section>

        {/* Stats Section */}
        <section className="py-12 border-y bg-muted/30">
            <div className="container px-4 md:px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {stats.map((stat, index) => (
                        <div key={index} className="space-y-2">
                            <h3 className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</h3>
                            <p className="text-sm md:text-base text-muted-foreground font-medium">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Problem & Solution */}
        <section className="py-20 md:py-32">
            <div className="container px-4 md:px-6">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <h2 className="text-3xl md:text-4xl font-bold">Running a business is hard. <br/>Managing finances shouldn't be.</h2>
                        <p className="text-lg text-muted-foreground">
                            90% of small businesses struggle with financial planning. Manual ledgers, complex Excel sheets, and expensive accountants are slowing you down.
                        </p>
                        <ul className="space-y-4">
                            {[
                                "Stop wasting 40+ hours on manual entry",
                                "Avoid costly GST filing mistakes",
                                "Get clear visibility on your actual profits",
                                "Make data-driven decisions, not guesses"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                        <X className="h-4 w-4" />
                                    </div>
                                    <span className="text-muted-foreground">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="relative rounded-2xl border bg-card p-2 shadow-2xl rotate-1 hover:rotate-0 transition-transform duration-500">
                        {/* Abstract UI Mockup */}
                        <div className="rounded-xl bg-muted/50 aspect-video flex items-center justify-center overflow-hidden relative">
                             <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent" />
                             <div className="text-center p-8 max-w-sm">
                                <div className="inline-flex items-center justify-center p-4 bg-background rounded-full shadow-lg mb-6">
                                    <Zap className="h-8 w-8 text-yellow-500" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">AI Insight Detected</h3>
                                <p className="text-sm text-muted-foreground">"Your profit margin increased by 15% this month. Consider restocking inventory now to maintain growth."</p>
                                <div className="mt-6 flex gap-2 justify-center">
                                    <div className="h-2 w-16 bg-primary/20 rounded-full"></div>
                                    <div className="h-2 w-8 bg-primary/20 rounded-full"></div>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20 bg-muted/30">
            <div className="container px-4 md:px-6">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to grow</h2>
                    <p className="text-lg text-muted-foreground">
                        Powerful tools designed specifically for the Indian market. Simple enough for a local shop, powerful enough for a growing enterprise.
                    </p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature, index) => (
                        <Card key={index} className="border-none shadow-md hover:shadow-lg transition-all hover:-translate-y-1">
                            <CardContent className="pt-6">
                                <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                                    <feature.icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                                <p className="text-muted-foreground">{feature.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20">
            <div className="container px-4 md:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
                    <p className="text-lg text-muted-foreground">Three simple steps to financial freedom</p>
                </div>
                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        { icon: Smartphone, title: "1. Snap & Send", desc: "Take a photo of your bill or type expenses on WhatsApp." },
                        { icon: Brain, title: "2. AI Processing", desc: "Our AI extracts data, categorizes it, and updates your ledger." },
                        { icon: TrendingUp, title: "3. Get Insights", desc: "Receive instant reports and growth tips on your dashboard." }
                    ].map((step, i) => (
                        <div key={i} className="flex flex-col items-center text-center">
                            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6 text-xl font-bold">
                                {i + 1}
                            </div>
                            <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                            <p className="text-muted-foreground max-w-xs">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 bg-muted/30">
            <div className="container px-4 md:px-6">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
                    <p className="text-lg text-muted-foreground">
                        Choose the plan that fits your business size. No hidden fees.
                    </p>
                </div>
                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {/* Free Plan */}
                    <Card className="flex flex-col">
                        <CardHeader>
                            <CardTitle>Starter</CardTitle>
                            <div className="text-3xl font-bold mt-2">₹0<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                            <p className="text-sm text-muted-foreground">For new businesses just getting started.</p>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col">
                            <ul className="space-y-3 mb-6 flex-1">
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Basic Dashboard</li>
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Daily Earnings Tracker</li>
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> 5 Document Uploads/mo</li>
                            </ul>
                            <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>Get Started</Button>
                        </CardContent>
                    </Card>
                    
                    {/* Pro Plan */}
                    <Card className="flex flex-col border-primary relative shadow-lg scale-105 z-10">
                        <div className="absolute -top-4 left-0 right-0 flex justify-center">
                            <Badge className="bg-primary text-primary-foreground hover:bg-primary">Most Popular</Badge>
                        </div>
                        <CardHeader>
                            <CardTitle>Growth</CardTitle>
                            <div className="text-3xl font-bold mt-2">₹499<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                            <p className="text-sm text-muted-foreground">For growing shops and businesses.</p>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col">
                            <ul className="space-y-3 mb-6 flex-1">
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Advanced AI Insights</li>
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Unlimited WhatsApp Support</li>
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> GST Reports</li>
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> 50 Document Uploads/mo</li>
                            </ul>
                            <Button className="w-full" onClick={() => navigate("/auth")}>Start Free Trial</Button>
                        </CardContent>
                    </Card>

                    {/* Enterprise Plan */}
                    <Card className="flex flex-col">
                        <CardHeader>
                            <CardTitle>Scale</CardTitle>
                            <div className="text-3xl font-bold mt-2">₹1499<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                            <p className="text-sm text-muted-foreground">For multi-store owners.</p>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col">
                            <ul className="space-y-3 mb-6 flex-1">
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Everything in Growth</li>
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Multi-user Access</li>
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Priority Support</li>
                                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Custom Integrations</li>
                            </ul>
                            <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>Contact Sales</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-32">
            <div className="container px-4 md:px-6">
                <div className="bg-primary rounded-3xl p-8 md:p-16 text-center text-primary-foreground relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 left-0 w-full h-full bg-black/10"></div>
                    <div className="relative z-10 max-w-3xl mx-auto space-y-8">
                        <h2 className="text-3xl md:text-5xl font-bold">Ready to modernize your business finances?</h2>
                        <p className="text-lg md:text-xl opacity-90">
                            Join thousands of Indian business owners who are saving time and money with VirtualCFO.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" variant="secondary" className="h-14 px-8 text-lg font-semibold text-primary hover:bg-white" onClick={() => navigate("/auth")}>
                                Get Started for Free
                            </Button>
                            <Button size="lg" variant="outline" className="h-14 px-8 text-lg bg-transparent border-white text-white hover:bg-white/10">
                                Schedule a Demo
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-12">
        <div className="container px-4 md:px-6">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 font-bold text-xl">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <IndianRupee className="h-5 w-5" />
                        </div>
                        <span>VirtualCFO</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Empowering India's small businesses with AI-driven financial intelligence.
                    </p>
                </div>
                <div>
                    <h4 className="font-semibold mb-4">Product</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li><a href="#" className="hover:text-primary">Features</a></li>
                        <li><a href="#" className="hover:text-primary">Pricing</a></li>
                        <li><a href="#" className="hover:text-primary">Security</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold mb-4">Company</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li><a href="#" className="hover:text-primary">About Us</a></li>
                        <li><a href="#" className="hover:text-primary">Contact</a></li>
                        <li><a href="#" className="hover:text-primary">Privacy Policy</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold mb-4">Connect</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li><a href="#" className="hover:text-primary">Twitter</a></li>
                        <li><a href="#" className="hover:text-primary">LinkedIn</a></li>
                        <li><a href="#" className="hover:text-primary">Instagram</a></li>
                    </ul>
                </div>
            </div>
            <div className="border-t pt-8 text-center text-sm text-muted-foreground">
                © {new Date().getFullYear()} VirtualCFO. Made with ❤️ for India.
            </div>
        </div>
      </footer>
    </div>
  );
}