// frontend/src/components/ProfileEnrichmentSection.jsx
// Complete LinkedIn profile enrichment display with refresh capability
import React, { useState } from 'react';
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
  RefreshCw,
  Linkedin,
  MapPin,
  Users,
  Sparkles,
  Clock,
  Globe,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

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

// Format relative time
const formatRelativeTime = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'agora mesmo';
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem atrás`;
  return date.toLocaleDateString('pt-BR');
};

// Section Title Component (matches "Dados" tab style)
const SectionTitle = ({ icon: Icon, title, count, iconColor = 'text-purple-500' }) => (
  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
    <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
    {title}
    {count !== undefined && (
      <span className="text-xs font-normal text-gray-400 dark:text-gray-500 normal-case">
        ({count})
      </span>
    )}
  </h4>
);

// Experience Section Component
const ExperienceSection = ({ experience }) => {
  const experiences = parseJsonArray(experience);
  const [showAll, setShowAll] = useState(false);
  if (experiences.length === 0) return null;

  const displayedExperiences = showAll ? experiences : experiences.slice(0, 4);

  return (
    <div>
      <SectionTitle icon={Briefcase} title="Experiência Profissional" count={experiences.length} />
      <div className="space-y-2">
        {displayedExperiences.map((exp, idx) => {
          const title = exp.position || exp.title || exp.role;
          const company = exp.company || exp.company_name || exp.organization;
          const location = exp.location;
          const startDate = exp.start || exp.start_date || exp.starts_at;
          const endDate = exp.end || exp.end_date || exp.ends_at;
          const isCurrent = !endDate && !exp.end;
          const description = exp.description || exp.summary;
          const companyLogo = exp.company_picture_url || exp.company_logo_url || exp.logo_url;

          return (
            <div key={idx} className="flex items-start gap-2.5 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt={company}
                  className="w-8 h-8 rounded object-contain bg-white border border-gray-200 dark:border-gray-600 flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                    {title}
                  </p>
                  {isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded flex-shrink-0">
                      Atual
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{company}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {(startDate || endDate) && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-500 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {startDate} - {endDate || 'Presente'}
                    </span>
                  )}
                  {location && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-500 flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      {location}
                    </span>
                  )}
                </div>
                {description && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
                    {description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {experiences.length > 4 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 py-1 text-center"
          >
            {showAll ? 'Mostrar menos' : `Ver todas ${experiences.length} experiências`}
          </button>
        )}
      </div>
    </div>
  );
};

// Education Section Component
const EducationSection = ({ education }) => {
  const educations = parseJsonArray(education);
  if (educations.length === 0) return null;

  return (
    <div>
      <SectionTitle icon={GraduationCap} title="Formação Acadêmica" count={educations.length} />
      <div className="space-y-2">
        {educations.map((edu, idx) => {
          const school = edu.school || edu.institution || edu.school_name;
          const degree = edu.degree || edu.degree_name;
          const field = edu.field_of_study || edu.field || edu.area;
          const startDate = edu.start || edu.start_date || edu.starts_at;
          const endDate = edu.end || edu.end_date || edu.ends_at;
          const schoolLogo = edu.school_picture_url || edu.school_logo_url || edu.logo_url;

          return (
            <div key={idx} className="flex items-start gap-2.5 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt={school}
                  className="w-8 h-8 rounded object-contain bg-white border border-gray-200 dark:border-gray-600 flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{school}</p>
                {(degree || field) && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {degree}
                    {degree && field && !degree.includes(field) && ` - ${field}`}
                  </p>
                )}
                {(startDate || endDate) && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5">
                    {startDate} - {endDate || 'Presente'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Skills Section Component
const SkillsSection = ({ skills }) => {
  const [showAll, setShowAll] = useState(false);
  if (!skills || skills.length === 0) return null;

  const displayedSkills = showAll ? skills : skills.slice(0, 12);

  return (
    <div>
      <SectionTitle icon={Star} title="Habilidades" count={skills.length} />
      <div className="flex flex-wrap gap-1.5">
        {displayedSkills.map((skill, idx) => {
          const skillName = typeof skill === 'string' ? skill : skill.name || skill.skill;
          const endorsements = typeof skill === 'object' ? (skill.endorsements || skill.endorsement_count || 0) : 0;

          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[11px] rounded"
            >
              {skillName}
              {endorsements > 0 && (
                <span className="flex items-center gap-0.5 text-gray-500 dark:text-gray-400">
                  <ThumbsUp className="w-2.5 h-2.5" />
                  {endorsements}
                </span>
              )}
            </span>
          );
        })}
      </div>
      {skills.length > 12 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 mt-2"
        >
          {showAll ? 'Mostrar menos' : `Ver todas ${skills.length}`}
        </button>
      )}
    </div>
  );
};

// Simple List Section Component
const SimpleListSection = ({ icon, title, items, renderItem }) => {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <SectionTitle icon={icon} title={title} count={items.length} />
      <div className="space-y-1.5">
        {items.slice(0, 4).map((item, idx) => (
          <div key={idx}>{renderItem(item)}</div>
        ))}
      </div>
    </div>
  );
};

// Main Component
const ProfileEnrichmentSection = ({ profile, contactId, onRefresh, className = '' }) => {
  const { t } = useTranslation(['contacts', 'common']);
  const [refreshing, setRefreshing] = useState(false);

  if (!profile) return null;

  // Parse all enrichment fields
  const experience = parseJsonArray(profile.experience);
  const education = parseJsonArray(profile.education);
  const skills = parseJsonArray(profile.skills);
  const certifications = parseJsonArray(profile.certifications);
  const languages = parseJsonArray(profile.languages);
  const publications = parseJsonArray(profile.publications);
  const projects = parseJsonArray(profile.projects);
  const volunteerExperience = parseJsonArray(profile.volunteer_experience);
  const honorsAwards = parseJsonArray(profile.honors_awards);
  const courses = parseJsonArray(profile.courses);
  const websites = parseJsonArray(profile.websites);

  // Check if there's any enrichment data
  const hasLinkedInData =
    experience.length > 0 ||
    education.length > 0 ||
    skills.length > 0 ||
    certifications.length > 0 ||
    languages.length > 0 ||
    publications.length > 0 ||
    projects.length > 0 ||
    volunteerExperience.length > 0 ||
    honorsAwards.length > 0 ||
    courses.length > 0 ||
    profile.full_profile_fetched_at;

  // Handle refresh
  const handleRefresh = async () => {
    if (!contactId) return;
    setRefreshing(true);
    try {
      await api.enrichContact(contactId, { force: true });
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error refreshing enrichment:', error);
    }
    setRefreshing(false);
  };

  // Get network distance label
  const getNetworkLabel = (distance) => {
    const labels = {
      'DISTANCE_1': '1º grau',
      'FIRST_DEGREE': '1º grau',
      'DISTANCE_2': '2º grau',
      'SECOND_DEGREE': '2º grau',
      'DISTANCE_3': '3º grau',
      'THIRD_DEGREE': '3º grau',
      'SELF': 'Você'
    };
    return labels[distance] || distance;
  };

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Linkedin className="w-4 h-4 text-[#0A66C2]" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Dados do LinkedIn
          </span>
          {profile.network_distance && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
              {getNetworkLabel(profile.network_distance)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {profile.full_profile_fetched_at && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatRelativeTime(profile.full_profile_fetched_at)}
            </span>
          )}
          {contactId && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Atualizando...' : 'Atualizar'}
            </button>
          )}
        </div>
      </div>

      {/* No data message */}
      {!hasLinkedInData && (
        <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
          <Sparkles className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Nenhum dado enriquecido disponível
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            {profile.linkedin_profile_id
              ? 'Clique em "Atualizar" para buscar os dados do LinkedIn'
              : 'Contato não possui perfil do LinkedIn vinculado'}
          </p>
        </div>
      )}

      {/* Stats and badges */}
      {hasLinkedInData && (profile.follower_count || profile.connections_count || profile.is_creator || profile.is_influencer || profile.is_open_to_work || profile.is_hiring) && (
        <div className="flex flex-wrap items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700">
          {profile.follower_count > 0 && (
            <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Users className="w-3 h-3 text-gray-400" />
              <strong className="text-gray-700 dark:text-gray-300">{profile.follower_count.toLocaleString()}</strong> seguidores
            </span>
          )}
          {profile.connections_count > 0 && (
            <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Linkedin className="w-3 h-3 text-[#0A66C2]" />
              <strong className="text-gray-700 dark:text-gray-300">{profile.connections_count >= 500 ? '500+' : profile.connections_count}</strong> conexões
            </span>
          )}
          {profile.is_open_to_work && (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Open to Work
            </span>
          )}
          {profile.is_hiring && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
              Hiring
            </span>
          )}
          {profile.is_creator && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
              Creator
            </span>
          )}
          {profile.is_influencer && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
              Influencer
            </span>
          )}
        </div>
      )}

      {/* Websites */}
      {websites.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {websites.map((site, idx) => {
            const url = typeof site === 'string' ? site : site.url || site.link;
            const label = typeof site === 'object' ? site.label || site.type : null;

            return (
              <a
                key={idx}
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-[11px] text-gray-600 dark:text-gray-400 transition-colors"
              >
                <Globe className="w-2.5 h-2.5" />
                {label || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            );
          })}
        </div>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <ExperienceSection experience={profile.experience} />
        </div>
      )}

      {/* Education */}
      {education.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <EducationSection education={profile.education} />
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <SkillsSection skills={skills} />
        </div>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <SimpleListSection
            icon={Award}
            title="Certificações"
            items={certifications}
            renderItem={(cert) => {
              const name = typeof cert === 'string' ? cert : cert.name || cert.title;
              const issuer = typeof cert === 'object' ? cert.issuer || cert.authority : null;
              return (
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{name}</span>
                  {issuer && <span className="text-gray-500 dark:text-gray-400"> · {issuer}</span>}
                </div>
              );
            }}
          />
        </div>
      )}

      {/* Languages */}
      {languages.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <SectionTitle icon={Languages} title="Idiomas" count={languages.length} />
          <div className="flex flex-wrap gap-1.5">
            {languages.map((lang, idx) => {
              const name = typeof lang === 'string' ? lang : lang.name || lang.language;
              const level = typeof lang === 'object' ? lang.proficiency || lang.level : null;
              return (
                <span
                  key={idx}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[11px] rounded"
                >
                  {name}
                  {level && <span className="text-gray-500 dark:text-gray-400 ml-1">({level})</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Publications */}
      {publications.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <SimpleListSection
            icon={FileText}
            title="Publicações"
            items={publications}
            renderItem={(pub) => {
              const title = typeof pub === 'string' ? pub : pub.title || pub.name;
              return <p className="text-xs text-gray-700 dark:text-gray-300">{title}</p>;
            }}
          />
        </div>
      )}

      {/* Volunteer Experience */}
      {volunteerExperience.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <SimpleListSection
            icon={Heart}
            title="Voluntariado"
            items={volunteerExperience}
            renderItem={(vol) => {
              const role = typeof vol === 'string' ? vol : vol.role || vol.title;
              const org = typeof vol === 'object' ? vol.organization : null;
              return (
                <div className="text-xs">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{role}</span>
                  {org && <span className="text-gray-500 dark:text-gray-400"> · {org}</span>}
                </div>
              );
            }}
          />
        </div>
      )}

      {/* Honors & Awards */}
      {honorsAwards.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <SimpleListSection
            icon={Trophy}
            title="Prêmios"
            items={honorsAwards}
            renderItem={(award) => {
              const title = typeof award === 'string' ? award : award.title || award.name;
              return <p className="text-xs text-gray-700 dark:text-gray-300">{title}</p>;
            }}
          />
        </div>
      )}

      {/* Courses */}
      {courses.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
          <SectionTitle icon={BookOpen} title="Cursos" count={courses.length} />
          <div className="flex flex-wrap gap-1.5">
            {courses.slice(0, 8).map((course, idx) => {
              const name = typeof course === 'string' ? course : course.name || course.title;
              return (
                <span
                  key={idx}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[11px] rounded"
                >
                  {name}
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
    <div className={`flex items-center gap-1.5 ${className}`}>
      {isOpenToWork && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-[10px]">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
          Open to Work
        </span>
      )}
      {isHiring && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px]">
          <Briefcase className="w-2.5 h-2.5" />
          Hiring
        </span>
      )}
    </div>
  );
};

export default ProfileEnrichmentSection;
