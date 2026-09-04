import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlatformShell } from '@/components/platform-shell';
import AcademyCoursePlayer from '@/components/academy-course-player';

export const dynamic = 'force-dynamic';

export default async function CourseRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase.from('profiles').select('full_name,role,status').eq('id', user.id).single();
  if (!profile || profile.role !== 'affiliate' || profile.status !== 'active') redirect('/');

  const { data: course } = await supabase.from('courses').select('id,title,slug,description,status').eq('slug', slug).eq('status','published').single();
  if (!course) notFound();

  const { data: modules } = await supabase.from('course_modules').select('id,title,description,position,estimated_minutes,icon,required_previous_module_id,status').eq('course_id', course.id).eq('status','published').order('position',{ascending:true});
  const moduleRows = modules || [];
  if (!moduleRows.length) notFound();

  const { data: lessons } = await supabase.from('lessons').select('id,module_id,title,content,lesson_type,estimated_minutes,objective,key_points,interactive_data,position,status').in('module_id', moduleRows.map(m=>m.id)).eq('status','published').order('position',{ascending:true});

  const { data: progress } = await supabase.from('lesson_progress').select('lesson_id,completed_at').eq('user_id', user.id);
  const completed = (progress || []).filter((p:any)=>p.completed_at).map((p:any)=>p.lesson_id);
  const lessonsByModule = moduleRows.map(m => ({ ...m, lessons: (lessons || []).filter((l:any)=>l.module_id === m.id) }));

  const payload = { id: course.id, title: course.title, slug: course.slug, description: course.description, modules: lessonsByModule };
  return <PlatformShell role="affiliate" name={profile.full_name || 'Afiliado'}><AcademyCoursePlayer course={payload as any} initialCompleted={completed}/></PlatformShell>;
}
