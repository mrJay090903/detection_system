'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LoginForm } from '@/components/ui/login-form';
import { FeedbackForm } from '@/components/ui/feedback-form';
import { 
  Cpu, 
  Search, 
  FileText, 
  BarChart3, 
  BookOpen, 
  UploadCloud, 
  ScanSearch, 
  ClipboardCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.8 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5 }
};

const LandingPage = () => {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-white overflow-x-hidden">
      
{/* ================= HERO SECTION ================= */}
<section className="relative w-full min-h-[700px] flex flex-col overflow-hidden">
  
  {/* Background with Enhanced Gradient and Pattern */}
  <div className="absolute inset-0 bg-gradient-to-br from-[#2d4a5f] via-[#4a667d] to-[#7a6a5a] z-0">
    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
  </div>

  {/* Navbar */}
  <motion.nav 
    initial={{ y: -100, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.6 }}
    className="container mx-auto px-6 py-6 flex justify-between items-center relative z-20 backdrop-blur-sm"
  >
    <Link href="/" className="group">
      <motion.div 
        className="flex items-center gap-3 group"
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        {/* Logo - BU Seal */}
        <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 shadow-lg transition-transform duration-300 group-hover:scale-110">
          <Image src="/assets/bu-logo.png" width={48} height={48} alt="BU Logo" className="object-cover" />
        </div>
        
        {/* Brand Name */}
        <div className="font-bold tracking-wide uppercase text-lg md:text-xl leading-none">
          <span className="text-[#3896DA] drop-shadow-lg">BICOL</span>
          <span className="text-[#F86D1B] drop-shadow-lg ml-1">UNIVERSITY</span>
          <span className="block text-xs md:text-sm font-semibold text-white mt-0.5 normal-case">BICOL UNIVERSITY POLANGUI</span>
        </div>
      </motion.div>
    </Link>

    {/* Login Button */}
    <LoginForm />
  </motion.nav>

  {/* Main Content */}
  <div className="container mx-auto px-6 flex-grow flex flex-col md:flex-row items-center relative z-10 mt-8 md:mt-0">
    
    {/* Left Text Content */}
    <motion.div 
      className="w-full md:w-1/2 space-y-8 pt-10 md:pt-0"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <motion.div 
        variants={fadeInUp}
        className="inline-block"
      >
        <motion.span 
          className="bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-semibold border border-white/20 shadow-lg inline-flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
        >
          <Sparkles className="w-4 h-4" />
          AI-Powered Research Tool
        </motion.span>
      </motion.div>
      
      <motion.h1 
        variants={fadeInUp}
        className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] drop-shadow-2xl"
      >
        Check. Compare.<br />
        <span className="text-[#fca311] relative inline-block">
          Improve
          <motion.span
            className="absolute -bottom-2 left-0 w-full h-1 bg-[#fca311]"
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 1, duration: 0.8 }}
          />
        </span> Your Research.
      </motion.h1>
      
      <motion.p 
        variants={fadeInUp}
        className="text-gray-100 text-lg md:text-xl max-w-lg leading-relaxed font-light"
      >
        AI-powered similarity detection to help students and researchers ensure originality, strengthen citations, and improve every draft.
      </motion.p>
      
      <motion.div 
        variants={fadeInUp}
        className="flex flex-wrap gap-4 pt-4"
      >
        {/* Try Now Button */}
        <Link href="/research-check">
          <motion.button 
            whileHover={{ scale: 1.05, boxShadow: "0 25px 50px -12px rgba(252, 163, 17, 0.5)" }}
            whileTap={{ scale: 0.95 }}
            className="bg-[#fca311] hover:bg-[#e59200] text-white px-10 py-4 rounded-lg font-bold shadow-xl transition-all duration-300 inline-flex items-center gap-2 group"
          >
            Try Now 
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </Link>
        
        {/* Learn More Button */}
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            const el = document.getElementById('how-it-works')
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            else window.location.hash = '#how-it-works'
          }}
          className="bg-white/10 hover:bg-white/20 text-white px-10 py-4 rounded-lg font-semibold border-2 border-white/30 hover:border-white transition-all duration-300 backdrop-blur-md"
        >
          Learn More
        </motion.button>
      </motion.div>


    </motion.div>

    {/* Right Image Area */}
    <motion.div 
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8 }}
      className="w-full md:w-1/2 h-[500px] md:h-auto flex justify-center md:justify-end items-center relative mt-12 md:mt-0 overflow-hidden"
    >
      <div className="relative w-full h-full max-w-[600px] flex items-center justify-center translate-y-50">
         <Image
           src="/assets/bu-torch.svg"
           alt="BU Torch Sculpture"
           width={600}
           height={700}
           className="object-contain object-center drop-shadow-2xl scale-170"
           priority
         />
      </div>
    </motion.div>
  </div>
</section>

      {/* ================= FEATURES SECTION ================= */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-100 rounded-full filter blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-100 rounded-full filter blur-3xl opacity-20 translate-x-1/2 translate-y-1/2"></div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="mb-16 text-center">
            <h2 className="text-[#1e3a5f] text-4xl md:text-5xl font-bold mb-4">Designed for academic excellence</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">Everything you need to confidently submit original, well-referenced work.</p>
          </div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {/* Card 1 */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -10, transition: { duration: 0.2 } }}
              className="bg-white p-8 rounded-2xl shadow-lg flex flex-col items-center text-center border border-gray-100 group cursor-pointer"
            >
              <motion.div 
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.6 }}
                className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-2xl mb-6 text-[#1e3a5f]"
              >
                <Cpu size={36} />
              </motion.div>
              <h3 className="font-bold text-gray-800 mb-3 text-lg">AI Similarity Insights</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Get detailed explanations of matched content powered by AI.
              </p>
            </motion.div>

            {/* Card 2 */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -10, transition: { duration: 0.2 } }}
              className="bg-white p-8 rounded-2xl shadow-lg flex flex-col items-center text-center border border-gray-100 group cursor-pointer"
            >
              <motion.div 
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.6 }}
                className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-2xl mb-6 text-purple-600"
              >
                <Search size={36} />
              </motion.div>
              <h3 className="font-bold text-gray-800 mb-3 text-lg">Detect Plagiarism Fast</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Quickly scan your research against thousands of documents.
              </p>
            </motion.div>

            {/* Card 3 */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -10, transition: { duration: 0.2 } }}
              className="bg-white p-8 rounded-2xl shadow-lg flex flex-col items-center text-center border border-gray-100 group cursor-pointer"
            >
              <motion.div 
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.6 }}
                className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-2xl mb-6 text-green-600"
              >
                <FileText size={36} />
              </motion.div>
              <h3 className="font-bold text-gray-800 mb-3 text-lg">Detailed Reports</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Comprehensive similarity analysis reports.
              </p>
            </motion.div>

            {/* Card 4 */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -10, transition: { duration: 0.2 } }}
              className="bg-white p-8 rounded-2xl shadow-lg flex flex-col items-center text-center border border-gray-100 group cursor-pointer"
            >
              <motion.div 
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.6 }}
                className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-2xl mb-6 text-[#fca311]"
              >
                <BarChart3 size={36} />
              </motion.div>
              <h3 className="font-bold text-gray-800 mb-3 text-lg">Research Metrics</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                See detailed similarity stats for every paper.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ================= HOW IT WORKS SECTION ================= */}
      <section id="how-it-works" className="py-24 bg-gradient-to-b from-white to-blue-50">
        <div className="container mx-auto px-6">
          <div className="mb-20 text-center">
            <h2 className="text-[#1e3a5f] text-4xl md:text-5xl font-bold mb-4">How it works</h2>
            <p className="text-gray-600 text-lg">From upload to insight in four simple steps.</p>
          </div>

          <div className="relative">
            {/* The Connector Line */}
            <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-1 bg-gradient-to-r from-[#00bfa5] via-blue-400 to-[#fca311] z-0 rounded-full"></div>

            <motion.div 
              className="grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10"
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              
              {/* Step 1 */}
              <motion.div 
                variants={fadeInUp}
                whileHover={{ scale: 1.05 }}
                className="flex flex-col items-center text-center group cursor-pointer"
              >
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00bfa5] to-[#00a890] text-white flex items-center justify-center font-bold text-xl mb-6 shadow-lg"
                >
                  <CheckCircle2 className="w-6 h-6" />
                </motion.div>
                <div className="mb-6 text-blue-500 bg-blue-50 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                   <BookOpen size={48} className="mx-auto" />
                </div>
                <h4 className="font-bold text-gray-800 mb-3 text-lg">Select your Course</h4>
                <p className="text-sm text-gray-600 max-w-[220px] leading-relaxed">Choose the course you would like to focus on to find similar research.</p>
              </motion.div>

              {/* Step 2 */}
              <motion.div 
                variants={fadeInUp}
                whileHover={{ scale: 1.05 }}
                className="flex flex-col items-center text-center group cursor-pointer"
              >
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-xl mb-6 shadow-lg"
                >
                  <CheckCircle2 className="w-6 h-6" />
                </motion.div>
                <div className="mb-6 text-purple-500 bg-purple-50 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                   <UploadCloud size={48} className="mx-auto" />
                </div>
                <h4 className="font-bold text-gray-800 mb-3 text-lg">Upload your paper</h4>
                <p className="text-sm text-gray-600 max-w-[220px] leading-relaxed">Drag & drop a PDF or DOCX, or input your proposed research text directly.</p>
              </motion.div>

              {/* Step 3 */}
              <motion.div 
                variants={fadeInUp}
                whileHover={{ scale: 1.05 }}
                className="flex flex-col items-center text-center group cursor-pointer"
              >
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xl mb-6 shadow-lg"
                >
                  <CheckCircle2 className="w-6 h-6" />
                </motion.div>
                <div className="mb-6 text-indigo-500 bg-indigo-50 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                   <ScanSearch size={48} className="mx-auto" />
                </div>
                <h4 className="font-bold text-gray-800 mb-3 text-lg">AI similarity analysis</h4>
                <p className="text-sm text-gray-600 max-w-[220px] leading-relaxed">Our engine scans the database to detect possible similarities and closely related content.</p>
              </motion.div>

              {/* Step 4 */}
              <motion.div 
                variants={fadeInUp}
                whileHover={{ scale: 1.05 }}
                className="flex flex-col items-center text-center group cursor-pointer"
              >
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-[#fca311] to-[#e59200] text-white flex items-center justify-center font-bold text-xl mb-6 shadow-lg"
                >
                  <CheckCircle2 className="w-6 h-6" />
                </motion.div>
                <div className="mb-6 text-orange-500 bg-orange-50 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                   <ClipboardCheck size={48} className="mx-auto" />
                </div>
                <h4 className="font-bold text-gray-800 mb-3 text-lg">Review your report</h4>
                <p className="text-sm text-gray-600 max-w-[220px] leading-relaxed">Explore detailed similarity matches along with AI-generated analysis and suggestions.</p>
              </motion.div>

            </motion.div>
          </div>
        </div>
      </section>

      {/* ================= ABOUT US SECTION ================= */}
      <section className="py-24 bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12">
          
          <motion.div 
            className="md:w-1/2"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-[#1e3a5f] text-4xl md:text-5xl font-bold mb-6">About Us</h2>
            <p className="text-gray-600 text-base mb-4 leading-relaxed">
              Designed for Bicol University Polangui students, our platform helps you compare your thesis proposal against previous submissions. Quickly detect similarities, avoid plagiarism, and make informed decisions on your research topic.
            </p>
            <p className="text-gray-600 text-base mb-8 leading-relaxed">
              Get instant feedback on your draft while ensuring academic integrity and streamlining your thesis planning process.
            </p>
            <FeedbackForm 
              trigger={
                <motion.button 
                  whileHover={{ scale: 1.05, boxShadow: "0 25px 50px -12px rgba(252, 163, 17, 0.5)" }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-[#fca311] hover:bg-[#e59200] text-white px-8 py-4 rounded-lg font-bold shadow-lg transition-all duration-300 inline-flex items-center gap-2"
                >
                  Give Us Feedback 
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              }
            />
          </motion.div>

          <motion.div 
            className="md:w-1/2 flex justify-center gap-8"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
             <motion.div 
               whileHover={{ scale: 1.1, rotate: 5 }}
               transition={{ type: "spring", stiffness: 300 }}
               className="w-36 h-36 md:w-44 md:h-44 bg-white rounded-full border-4 border-blue-200 flex items-center justify-center overflow-hidden shadow-xl cursor-pointer"
             >
                <Image src="/assets/bu-logo.png" width={176} height={176} alt="BU Logo" className="object-cover" />
             </motion.div>
             <motion.div 
               whileHover={{ scale: 1.1, rotate: -5 }}
               transition={{ type: "spring", stiffness: 300 }}
               className="w-36 h-36 md:w-44 md:h-44 bg-white rounded-full border-4 border-orange-200 flex items-center justify-center overflow-hidden shadow-xl cursor-pointer"
             >
                <Image src="/assets/bup-logo.png" width={176} height={176} alt="Campus Logo" className="object-cover" />
             </motion.div>
          </motion.div>

        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-gradient-to-b from-[#0b1120] to-[#050810] text-gray-400 py-16 text-sm border-t border-gray-800">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          
          {/* Column 1 */}
          <div>
            <h5 className="text-white font-bold mb-4 text-lg">Research Similarity<br/>Detection System</h5>
            <p className="text-sm leading-relaxed mb-4 text-gray-400">
              A Research Similarity Detection System is a software application designed to automatically analyze and compare research titles or abstracts to determine their degree of similarity.
            </p>
          </div>

          {/* Column 2 */}
          <div>
            <h5 className="text-white font-bold mb-4 text-lg">Resources</h5>
            <ul className="space-y-3">
              <li className="hover:text-[#fca311] cursor-pointer transition-colors">Documentation</li>
              <li className="hover:text-[#fca311] cursor-pointer transition-colors">User Guide</li>
            </ul>
          </div>

          {/* Column 3 */}
          <div>
            <h5 className="text-white font-bold mb-4 text-lg">Websites</h5>
            <ul className="space-y-3">
              <li className="hover:text-[#fca311] cursor-pointer transition-colors">BULMS</li>
              <li className="hover:text-[#fca311] cursor-pointer transition-colors">BU Portal</li>
            </ul>
          </div>

          {/* Column 4 */}
          <div>
            <h5 className="text-white font-bold mb-4 text-lg">Legal</h5>
            <ul className="space-y-3">
              <li className="hover:text-[#fca311] cursor-pointer transition-colors">Privacy Policy</li>
              <li className="hover:text-[#fca311] cursor-pointer transition-colors">Terms of Service</li>
              <li className="hover:text-[#fca311] cursor-pointer transition-colors">Security</li>
            </ul>
          </div>
        </div>

        <div className="container mx-auto px-6 mt-12 pt-8 border-t border-gray-800 text-center text-xs">
          © 2025 Research Similarity Detection System. All rights reserved.
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
