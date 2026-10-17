const footerColumns = [
  {
    heading: "Employer",
    links: ["How it works", "Register", "Post a Job", "FAQ"],
  },
  {
    heading: "Jobseeker",
    links: ["How it Works", "Register", "Job Search", "FAQ"],
  },
  {
    heading: "Program & Services",
    wide: true,
    links: [
      "Job Matching and Placement",
      "Jobs Fair",
      "Career Guidance and Employment Counseling",
      "Skills Training and Livelihood Assistance",
      "Labor Market Information (LMI)",
      "Special Program for Employment of Students (SPES)",
      "Government Internship Program (GIP)",
      "Employment Referral Services",
    ],
  },
  {
    heading: "Other Goods",
    links: ["Privacy Policy", "Terms of Use", "Contact Us"],
  },
  {
    heading: "Connect with Us",
    links: [],
    social: true,
  },
];

function PublicFooter() {
  return (
    <footer className="bg-white text-gray-900 shadow-[0_-8px_20px_-4px_rgba(0,0,0,0.18)]">
      <div className="w-full px-[42px] py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-8">
          {footerColumns.map((col) => (
            <div key={col.heading} className={col.wide ? "sm:col-span-2" : ""}>
              <h3 className={`text-base font-bold text-primary mb-1 ${col.wide ? "sm:text-center" : ""}`}>
                {col.heading}
              </h3>
              {col.social ? (
                <a href="https://www.facebook.com/people/PESO-Santa-Maria-Official/100082490811894/" className="flex items-center gap-2 text-gray-800 hover:text-primary transition-colors" aria-label="Facebook" target="_blank" rel="noopener noreferrer">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  <span className="text-sm">PESO – SANTA MARIA</span>
                </a>
              ) : (
                <ul className={`list-disc pl-5 space-y-2 text-sm text-gray-700 ${col.wide ? "sm:columns-2 sm:gap-x-8" : ""}`}>
                  {col.links.map((link) => (
                    <li key={link} className="break-inside-avoid">
                      <a href="#" className="hover:text-primary transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        <p className="mt-1 text-center text-sm text-primary/70">
          Copyright © {new Date().getFullYear()} JobLinked. All Rights Reserved
        </p>
      </div>
    </footer>
  );
}

export default PublicFooter;
