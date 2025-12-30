// frontend/src/components/ProfileEnrichmentSection.jsx
import React from 'react';
import {
  Award,
  GraduationCap,
  Languages,
  Briefcase,
  Heart,
  BookOpen,
  FileText,
  Trophy,
  Star,
  ThumbsUp,
  CheckCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Helper to safely parse JSON arrays
const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const ProfileEnrichmentSection = ({ profile, className = '' }) => {
  const { t } = useTranslation(['contacts', 'common']);

  if (!profile) return null;

  // Parse all enrichment fields
  const skills = parseJsonArray(profile.skills);
  const certifications = parseJsonArray(profile.certifications);
  const languages = parseJsonArray(profile.languages);
  const publications = parseJsonArray(profile.publications);
  const projects = parseJsonArray(profile.projects);
  const volunteerExperience = parseJsonArray(profile.volunteer_experience);
  const honorsAwards = parseJsonArray(profile.honors_awards);
  const courses = parseJsonArray(profile.courses);

  // Check if there's any enrichment data to display
  const hasEnrichmentData =
    skills.length > 0 ||
    certifications.length > 0 ||
    languages.length > 0 ||
    publications.length > 0 ||
    projects.length > 0 ||
    volunteerExperience.length > 0 ||
    honorsAwards.length > 0 ||
    courses.length > 0;

  if (!hasEnrichmentData) return null;

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Skills Section */}
      {skills.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            <Star className="w-4 h-4 text-amber-500" />
            {t('enrichment.skills', 'Habilidades')}
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
              ({skills.length})
            </span>
          </h4>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, idx) => {
              const skillName = typeof skill === 'string' ? skill : skill.name || skill.skill;
              const endorsements = typeof skill === 'object' ? (skill.endorsements || skill.endorsement_count || 0) : 0;

              return (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm rounded-lg border border-amber-200 dark:border-amber-700"
                >
                  <span>{skillName}</span>
                  {endorsements > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                      <ThumbsUp className="w-3 h-3" />
                      {endorsements}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Certifications Section */}
      {certifications.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            {t('enrichment.certifications', 'Certificacoes')}
          </h4>
          <div className="space-y-2">
            {certifications.map((cert, idx) => {
              const certName = typeof cert === 'string' ? cert : cert.name || cert.title;
              const issuer = typeof cert === 'object' ? cert.issuer || cert.authority || cert.organization : null;
              const date = typeof cert === 'object' ? cert.date || cert.issued_date || cert.year : null;

              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                >
                  <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{certName}</p>
                    {(issuer || date) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {issuer && <span>{issuer}</span>}
                        {issuer && date && <span className="mx-1">-</span>}
                        {date && <span>{date}</span>}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Languages Section */}
      {languages.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            <Languages className="w-4 h-4 text-green-600 dark:text-green-400" />
            {t('enrichment.languages', 'Idiomas')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {languages.map((lang, idx) => {
              const langName = typeof lang === 'string' ? lang : lang.name || lang.language;
              const proficiency = typeof lang === 'object' ? lang.proficiency || lang.level : null;

              const proficiencyColors = {
                native: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                nativo: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                fluent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                fluente: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                professional: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
                profissional: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
                intermediate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                intermediario: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                basic: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                basico: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              };

              const colorClass = proficiency
                ? proficiencyColors[proficiency.toLowerCase()] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClass.includes('green') ? 'border-green-200 dark:border-green-700' : colorClass.includes('blue') ? 'border-blue-200 dark:border-blue-700' : colorClass.includes('purple') ? 'border-purple-200 dark:border-purple-700' : colorClass.includes('amber') ? 'border-amber-200 dark:border-amber-700' : 'border-gray-200 dark:border-gray-600'} ${colorClass}`}
                >
                  <span className="text-sm font-medium">{langName}</span>
                  {proficiency && (
                    <span className="text-xs opacity-80">({proficiency})</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Publications Section */}
      {publications.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            {t('enrichment.publications', 'Publicacoes')}
          </h4>
          <div className="space-y-2">
            {publications.map((pub, idx) => {
              const pubTitle = typeof pub === 'string' ? pub : pub.title || pub.name;
              const publisher = typeof pub === 'object' ? pub.publisher || pub.source : null;
              const date = typeof pub === 'object' ? pub.date || pub.year : null;

              return (
                <div
                  key={idx}
                  className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{pubTitle}</p>
                  {(publisher || date) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {publisher && <span>{publisher}</span>}
                      {publisher && date && <span className="mx-1">-</span>}
                      {date && <span>{date}</span>}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Projects Section */}
      {projects.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {t('enrichment.projects', 'Projetos')}
          </h4>
          <div className="space-y-2">
            {projects.map((project, idx) => {
              const projectName = typeof project === 'string' ? project : project.name || project.title;
              const description = typeof project === 'object' ? project.description : null;
              const date = typeof project === 'object' ? project.date || project.year : null;

              return (
                <div
                  key={idx}
                  className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{projectName}</p>
                  {date && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{date}</p>
                  )}
                  {description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Volunteer Experience Section */}
      {volunteerExperience.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            <Heart className="w-4 h-4 text-pink-600 dark:text-pink-400" />
            {t('enrichment.volunteer', 'Voluntariado')}
          </h4>
          <div className="space-y-2">
            {volunteerExperience.map((vol, idx) => {
              const role = typeof vol === 'string' ? vol : vol.role || vol.title || vol.position;
              const org = typeof vol === 'object' ? vol.organization || vol.company : null;
              const cause = typeof vol === 'object' ? vol.cause : null;

              return (
                <div
                  key={idx}
                  className="p-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-700"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{role}</p>
                  {org && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{org}</p>
                  )}
                  {cause && (
                    <p className="text-xs text-pink-600 dark:text-pink-400 mt-0.5">{cause}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Honors & Awards Section */}
      {honorsAwards.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            {t('enrichment.honors', 'Premios e Honrarias')}
          </h4>
          <div className="space-y-2">
            {honorsAwards.map((award, idx) => {
              const awardTitle = typeof award === 'string' ? award : award.title || award.name;
              const issuer = typeof award === 'object' ? award.issuer || award.organization : null;
              const date = typeof award === 'object' ? award.date || award.year : null;

              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700"
                >
                  <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{awardTitle}</p>
                    {(issuer || date) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {issuer && <span>{issuer}</span>}
                        {issuer && date && <span className="mx-1">-</span>}
                        {date && <span>{date}</span>}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Courses Section */}
      {courses.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            {t('enrichment.courses', 'Cursos')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {courses.map((course, idx) => {
              const courseName = typeof course === 'string' ? course : course.name || course.title;

              return (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-sm rounded-lg border border-teal-200 dark:border-teal-700"
                >
                  {courseName}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Badges Component for is_open_to_work and is_hiring
export const ProfileBadges = ({ profile, className = '' }) => {
  if (!profile) return null;

  const isOpenToWork = profile.is_open_to_work || profile.open_to_work;
  const isHiring = profile.is_hiring || profile.hiring;

  if (!isOpenToWork && !isHiring) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isOpenToWork && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-full">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs font-medium text-green-700 dark:text-green-300">
            Open to Work
          </span>
        </div>
      )}
      {isHiring && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-full">
          <Briefcase className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Hiring
          </span>
        </div>
      )}
    </div>
  );
};

export default ProfileEnrichmentSection;
