-- REBUSCÁNDOME — CURSO 02
-- Cliente, Oferta y Persuasión
-- Requiere 008_academia_interactive.sql

insert into public.courses(title,slug,description,type,status)
values('Cliente, Oferta y Persuasión','cliente-oferta-persuasion','Aprende a comprender problemas valiosos, construir propuestas de valor, elegir ángulos y responder objeciones para comunicar mejor una oferta.','general','published')
on conflict(slug) do update set title=excluded.title,description=excluded.description,status='published';

insert into public.course_modules(course_id,title,slug,description,position,estimated_minutes,icon,color_key,status)
select c.id,x.title,x.slug,x.description,x.position,x.minutes,x.icon,x.color_key,'published'
from public.courses c
cross join (values
('Piensa como comprador','piensa-como-comprador','Necesidad, contexto, fricción y decisión.',1,21,'🧠','blue'),
('Encuentra el problema valioso','encuentra-problema-valioso','Problemas que la gente sí quiere resolver.',2,20,'🔎','yellow'),
('Construye la propuesta de valor','construye-propuesta-valor','Persona + problema + resultado + mecanismo.',3,23,'💎','green'),
('Aumenta el valor percibido','aumenta-valor-percibido','Claridad, prueba, riesgo y contexto.',4,22,'✨','blue'),
('Ángulos y persuasión','angulos-y-persuasion','Encuentra el enfoque que hace relevante la oferta.',5,23,'🎯','yellow'),
('Objeciones y confianza','objeciones-y-confianza','Entiende antes de responder.',6,24,'🤝','green'),
('Tu oferta lista para vender','tu-oferta-lista-para-vender','Integra y convierte todo lo aprendido en una propuesta.',7,27,'🚀','navy')
) x(title,slug,description,position,minutes,icon,color_key)
where c.slug='cliente-oferta-persuasion'
on conflict(course_id,slug) do update set title=excluded.title,description=excluded.description,position=excluded.position,estimated_minutes=excluded.estimated_minutes,icon=excluded.icon,color_key=excluded.color_key,status='published';

update public.course_modules cm set required_previous_module_id=prev.id
from public.course_modules prev join public.courses c on c.id=cm.course_id and c.id=prev.course_id
where c.slug='cliente-oferta-persuasion' and prev.position=cm.position-1;

select 'REBUSCÁNDOME: Curso 02 creado correctamente' as result;
