import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BookOpen, CheckCircle2, Flame, GraduationCap, MessageCircle, Sparkles, Target, TrendingUp, Trophy, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell, PageHeader } from '@/components/platform-shell';

export const dynamic = 'force-dynamic';

const courseMeta: Record<string, { level: string; label: string; icon: typeof Sparkles; tone: string; outcome: string }> = {
  'fundamentos-marketing-que-vende': { level: 'NIVEL 01', label: 'Fundamentos', icon: Sparkles, tone: 'blue', outcome: 'Entender cómo piensa y compra tu cliente.' },
  'cliente-oferta-persuasion': { level: 'NIVEL 02', label: 'Cliente + Oferta', icon: Target, tone: 'yellow', outcome: 'Construir ofertas que tengan sentido para el cliente.' },
  'contenido-que-vende': { level: 'NIVEL 03', label: 'Contenido', icon: Flame, tone: 'green', outcome: 'Crear contenido que atraiga y abra conversaciones.' },
  'whatsapp-conversaciones-que-convierten': { level: 'NIVEL 04', label: 'Conversación', icon: MessageCircle, tone: 'blue', outcome: 'Llevar conversaciones hacia una decisión de compra.' },
  'ventas-conversion-escalamiento': { level: 'NIVEL 05', label: 'Crecimiento', icon: TrendingUp, tone: 'purple', outcome: 'Medir, mejorar y escalar tus ventas.' },
};

export default async function AcademiaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase.from('profiles').select('full_name, role, status').eq('id', user.id).single();
  if (!profile || profile.role !== 'affiliate' || profile.status !== 'active') redirect('/');

  const { data: courses } = await supabase.from('courses').select('id,title,slug,description,status').eq('status', 'published').order('created_at', { ascending: true });
  const courseRows = courses || [];
  const courseIds = courseRows.map((c) => c.id);

  const [modulesRes, progressRes, lessonsRes] = courseIds.length ? await Promise.all([
    supabase.from('course_modules').select('id,course_id,title,position,estimated_minutes,status').in('course_id', courseIds).eq('status', 'published').order('position', { ascending: true }),
    supabase.from('lesson_progress').select('lesson_id,completed_at').eq('user_id', user.id),
    supabase.from('lessons').select('id,module_id,course_id,title,position,status').in('course_id', courseIds).eq('status', 'published').order('position', { ascending: true }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];

  const modules = modulesRes.data || [];
  const lessons = lessonsRes.data || [];
  const completed = new Set((progressRes.data || []).filter((p) => p.completed_at).map((p) => p.lesson_id));
  const lessonsByCourse: Record<string, typeof lessons> = {};
  for (const lesson of lessons) (lessonsByCourse[lesson.course_id] ||= []).push(lesson);

  const totalLessons = lessons.length;
  const totalCompleted = lessons.filter((lesson) => completed.has(lesson.id)).length;
  const globalProgress = totalLessons ? Math.round((totalCompleted / totalLessons) * 100) : 0;
  const firstIncompleteCourse = courseRows.find((course) => (lessonsByCourse[course.id] || []).some((lesson) => !completed.has(lesson.id))) || courseRows[0];
  const nextLesson = firstIncompleteCourse ? (lessonsByCourse[firstIncompleteCourse.id] || []).find((lesson) => !completed.has(lesson.id)) : null;

  return (
    <PlatformShell role="affiliate" name={profile.full_name || 'Afiliado'}>
      <PageHeader eyebrow="ÁREA AFILIADO" title="Academia" description="Todos tus cursos están disponibles. Elige qué habilidad quieres fortalecer y estudia a tu ritmo." />

      <section className="academy-home-hero academy-home-hero-open">
        <div>
          <span className="academy-home-kicker"><GraduationCap size={14}/> ACADEMIA REBUSCÁNDOME</span>
          <h2>Aprende lo que necesitas para vender mejor.</h2>
          <p>Accede libremente a todos los cursos publicados, guarda tu progreso y retoma cualquier capacitación cuando quieras.</p>
          <div className="academy-home-badges">
            <span><Zap size={13}/> Lecciones cortas</span>
            <span><Target size={14}/> Aplicación práctica</span>
            <span><CheckCircle2 size={14}/> Todos desbloqueados</span>
          </div>
        </div>
        <div className="academy-home-side">
          <small className="academy-home-side-label">PROGRESO GENERAL</small>
          <strong>{globalProgress}%</strong>
          <span>{totalCompleted} de {totalLessons} lecciones completadas</span>
          <div className="academy-home-bar"><i style={{ width: `${globalProgress}%` }} /></div>
          <Link href={firstIncompleteCourse ? `/afiliado/academia/curso/${firstIncompleteCourse.slug}` : '/afiliado/academia'} className="academy-start-btn">
            {globalProgress ? 'Continuar aprendiendo' : 'Comenzar ahora'} <ArrowRight size={15}/>
          </Link>
        </div>
      </section>

      <section className="academy-learning-strip">
        <div><span>01</span><strong>Elige</strong><small>Abre cualquier curso disponible.</small></div>
        <div><span>02</span><strong>Aprende</strong><small>Conceptos claros y accionables.</small></div>
        <div><span>03</span><strong>Practica</strong><small>Aplica lo aprendido con retos.</small></div>
        <div><span>04</span><strong>Vende</strong><small>Lleva la formación a tu negocio.</small></div>
      </section>

      <section className="academy-course-catalog">
        <div className="academy-catalog-head">
          <div><span className="native-eyebrow">CATÁLOGO DE FORMACIÓN</span><h2>Elige tu próximo curso</h2><p>No hay cursos bloqueados. Puedes comenzar por el tema que más necesites reforzar.</p></div>
          <span className="academy-catalog-chip">{courseRows.length} cursos disponibles</span>
        </div>

        <div className="academy-real-course-grid academy-open-course-grid">
          {courseRows.map((course, index) => {
            const meta = courseMeta[course.slug] || { level: `NIVEL ${String(index + 1).padStart(2, '0')}`, label: 'Formación', icon: BookOpen, tone: 'blue', outcome: 'Desarrolla una nueva habilidad comercial.' };
            const Icon = meta.icon;
            const courseLessons = lessonsByCourse[course.id] || [];
            const done = courseLessons.filter((lesson) => completed.has(lesson.id)).length;
            const pct = courseLessons.length ? Math.round((done / courseLessons.length) * 100) : 0;
            const courseNext = courseLessons.find((lesson) => !completed.has(lesson.id));
            const status = pct === 100 ? 'COMPLETADO' : pct > 0 ? 'EN PROGRESO' : 'DISPONIBLE';
            return (
              <article className={`academy-real-course-card academy-open-course-card tone-${meta.tone} ${pct === 100 ? 'is-complete' : ''}`} key={course.id}>
                <div className="academy-progressive-line"><span className="academy-progressive-number">{pct === 100 ? <Trophy size={15}/> : index + 1}</span><div className="academy-progressive-status">{status}</div><b>{pct}%</b></div>
                <div className="academy-real-course-top"><div className="academy-real-course-icon"><Icon size={20}/></div><span>{meta.level} · {meta.label}</span></div>
                <h3>{course.title}</h3>
                <p>{course.description || meta.outcome}</p>
                <div className="academy-real-course-progress"><i style={{ width: `${pct}%` }}/></div>
                <div className="academy-real-course-meta"><span><BookOpen size={14}/> {modules.filter((m) => m.course_id === course.id).length} módulos</span><span><Target size={14}/> {courseLessons.length} lecciones</span></div>
                <div className="academy-progressive-next"><strong>{pct === 100 ? 'Curso completado' : pct ? 'Retoma desde' : 'Qué aprenderás'}</strong><span>{pct === 100 ? 'Puedes volver a repasarlo cuando quieras.' : courseNext ? courseNext.title : meta.outcome}</span></div>
                <div className="academy-real-course-actions"><Link href={`/afiliado/academia/curso/${course.slug}`} className="academy-start-btn secondary-course">{pct === 100 ? 'Repasar' : pct ? 'Continuar' : 'Estudiar curso'} <ArrowRight size={15}/></Link></div>
              </article>
            );
          })}
          {!courseRows.length && <div className="academy-empty-state"><BookOpen size={22}/><div><strong>Aún no hay cursos publicados</strong><p>Cuando Administración publique formación, aparecerá aquí automáticamente.</p></div></div>}
        </div>

        {nextLesson && firstIncompleteCourse && <Link className="academy-continue-banner" href={`/afiliado/academia/curso/${firstIncompleteCourse.slug}`}><div className="academy-continue-icon"><Sparkles size={18}/></div><div><span>RETOMA TU PROGRESO</span><strong>{nextLesson.title}</strong><small>{firstIncompleteCourse.title}</small></div><ArrowRight size={18}/></Link>}
      </section>
    </PlatformShell>
  );
}
