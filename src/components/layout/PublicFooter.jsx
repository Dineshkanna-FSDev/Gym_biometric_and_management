import { Link } from 'react-router-dom';
import { Clock, Dumbbell, Mail, MapPin, Phone } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Static footer with gym address, hours, and contact links.
 */
export default function PublicFooter() {
  return (
    <footer id="contact" className="border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-slate-950">
                <Dumbbell className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold tracking-tight">
                Fit <span className="text-amber-400">&amp;</span> Impact
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              High-performance strength, conditioning, and touchless facial biometric entry built for serious consistency.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="#programs" className="transition hover:text-amber-400">
                  Training Programs
                </a>
              </li>
              <li>
                <a href="#plans" className="transition hover:text-amber-400">
                  Membership Plans
                </a>
              </li>
              <li>
                <a href="#facilities" className="transition hover:text-amber-400">
                  Gym Facilities
                </a>
              </li>
              <li>
                <Link to="/login" className="transition hover:text-amber-400">
                  Admin Portal Login
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Training Hours
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <p className="font-medium text-slate-200">Mon – Sat</p>
                  <p>05:00 AM – 10:30 PM</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <p className="font-medium text-slate-200">Sunday</p>
                  <p>06:30 AM – 01:00 PM</p>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Visit &amp; Contact
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>2nd Floor, Impact Fitness Plaza, Anna Nagar, Chennai 600040</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-amber-400" />
                <a href="tel:+919876543210" className="transition hover:text-white">
                  +91 98765 43210
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-amber-400" />
                <a href="mailto:hello@fitandimpact.com" className="transition hover:text-white">
                  hello@fitandimpact.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>&copy; {CURRENT_YEAR} Fit &amp; Impact (fitandimpact.com). All rights reserved.</p>
          <p>Powered by ZKFace V4.0 Biometric Access</p>
        </div>
      </div>
    </footer>
  );
}
