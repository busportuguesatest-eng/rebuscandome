-- REBUSCÁNDOME — CURSO 03: CONTENIDO QUE VENDE
-- Crea el curso y sus 7 módulos / 21 lecciones.

DO $$
DECLARE
  v_course uuid;
  v_m1 uuid; v_m2 uuid; v_m3 uuid; v_m4 uuid; v_m5 uuid; v_m6 uuid; v_m7 uuid;
BEGIN
  INSERT INTO public.courses (title, slug, description, type, status)
  VALUES (
    'Contenido que Vende',
    'contenido-que-vende',
    'Aprende a crear hooks, Reels, Stories y contenido sin aparecer con estructura, intención y medición.',
    'general',
    'published'
  )
  ON CONFLICT (slug) DO UPDATE SET
    title = excluded.title,
    description = excluded.description,
    type = excluded.type,
    status = excluded.status
  RETURNING id INTO v_course;

  SELECT id INTO v_m1 FROM public.course_modules WHERE course_id=v_course AND slug='la-atencion-primero';
  IF v_m1 IS NULL THEN INSERT INTO public.course_modules(course_id,title,slug,description,position,estimated_minutes,icon,color_key,status) VALUES(v_course,'La atención primero','la-atencion-primero','Haz que la persona quiera detenerse y seguir.',1,21,'🎯','blue','published') RETURNING id INTO v_m1; END IF;
  SELECT id INTO v_m2 FROM public.course_modules WHERE course_id=v_course AND slug='hooks-que-detienen-el-scroll';
  IF v_m2 IS NULL THEN INSERT INTO public.course_modules(course_id,title,slug,description,position,estimated_minutes,icon,color_key,status) VALUES(v_course,'Hooks que detienen el scroll','hooks-que-detienen-el-scroll','Aprende a abrir una pieza de contenido con fuerza.',2,23,'⚡','yellow','published') RETURNING id INTO v_m2; END IF;
  SELECT id INTO v_m3 FROM public.course_modules WHERE course_id=v_course AND slug='reels-que-cuentan-y-venden';
  IF v_m3 IS NULL THEN INSERT INTO public.course_modules(course_id,title,slug,description,position,estimated_minutes,icon,color_key,status) VALUES(v_course,'Reels que cuentan y venden','reels-que-cuentan-y-venden','Construye una pieza corta con estructura comercial.',3,24,'🎬','green','published') RETURNING id INTO v_m3; END IF;
  SELECT id INTO v_m4 FROM public.course_modules WHERE course_id=v_course AND slug='stories-que-generan-conversacion';
  IF v_m4 IS NULL THEN INSERT INTO public.course_modules(course_id,title,slug,description,position,estimated_minutes,icon,color_key,status) VALUES(v_course,'Stories que generan conversación','stories-que-generan-conversacion','Usa secuencias cortas para acercar al prospecto.',4,22,'💬','blue','published') RETURNING id INTO v_m4; END IF;
  SELECT id INTO v_m5 FROM public.course_modules WHERE course_id=v_course AND slug='contenido-sin-aparecer';
  IF v_m5 IS NULL THEN INSERT INTO public.course_modules(course_id,title,slug,description,position,estimated_minutes,icon,color_key,status) VALUES(v_course,'Contenido sin aparecer','contenido-sin-aparecer','Vende usando sistemas visuales y narrativos.',5,22,'🎥','yellow','published') RETURNING id INTO v_m5; END IF;
  SELECT id INTO v_m6 FROM public.course_modules WHERE course_id=v_course AND slug='cta-y-recorrido';
  IF v_m6 IS NULL THEN INSERT INTO public.course_modules(course_id,title,slug,description,position,estimated_minutes,icon,color_key,status) VALUES(v_course,'CTA y recorrido','cta-y-recorrido','Haz que el contenido tenga un siguiente paso claro.',6,22,'➡️','green','published') RETURNING id INTO v_m6; END IF;
  SELECT id INTO v_m7 FROM public.course_modules WHERE course_id=v_course AND slug='tu-sistema-de-contenido';
  IF v_m7 IS NULL THEN INSERT INTO public.course_modules(course_id,title,slug,description,position,estimated_minutes,icon,color_key,status) VALUES(v_course,'Tu sistema de contenido','tu-sistema-de-contenido','Integra todo en una rutina que puedas medir.',7,28,'🚀','navy','published') RETURNING id INTO v_m7; END IF;

  INSERT INTO public.lessons(course_id,module_id,title,content,lesson_type,estimated_minutes,objective,key_points,interactive_data,position,status) VALUES
  (v_course,v_m1,'Qué hace que un contenido funcione','Un contenido comercial necesita una razón clara para ser visto y un siguiente paso que tenga sentido.','content',7,'Entender atención como puerta a la relevancia.','["Contexto","Relevancia","Siguiente paso"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m1,'Encuentra el punto de entrada','La misma oferta puede comenzar desde una pregunta, un problema, una observación o una promesa específica.','quiz',6,'Elegir un punto de entrada relevante.','["Situación","Problema","Curiosidad"]','{"type":"multiple_choice","question":"¿Cuál es un mejor punto de entrada?","options":["Tengo algo increíble","¿Cuánto tiempo pierdes cada domingo organizando tu semana?","Compra mi producto","Nuevo contenido"],"correctIndex":1}',2,'published'),
  (v_course,v_m1,'Tu primer ángulo de contenido','Transforma una situación cotidiana en una idea que despierte interés.','challenge',8,'Convertir contexto en idea de contenido.','["Situación","Tensión","Curiosidad"]','{"type":"builder"}',3,'published'),

  (v_course,v_m2,'Anatomía de un hook','Un hook eficaz es específico, relevante y fácil de procesar.','content',8,'Reconocer componentes de un buen hook.','["Especificidad","Relevancia","Claridad"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m2,'Elige el hook ganador','Compara opciones por claridad y relevancia.','quiz',6,'Identificar hooks concretos.','["Concreto","Relevante","Procesable"]','{"type":"multiple_choice","question":"¿Cuál es el hook más específico?","options":["Te tengo un tip","La mejor guía","3 errores que te hacen perder horas organizando tu contenido","Esto cambiará tu vida"],"correctIndex":2}',2,'published'),
  (v_course,v_m2,'Hook Lab','Construye una biblioteca de hooks reutilizables.','challenge',9,'Crear hooks desde distintos enfoques.','["Pregunta","Error","Lista","Contraste","Curiosidad"]','{"type":"builder"}',3,'published'),

  (v_course,v_m3,'La estructura de un Reel','Una pieza breve puede seguir hook → contexto → valor → prueba → CTA.','content',8,'Comprender una estructura comercial breve.','["Hook","Contexto","Valor","Prueba","CTA"]','{"type":"sequence","items":["CTA","Hook","Valor","Contexto","Prueba"],"correctOrder":[1,3,2,4,0]}',1,'published'),
  (v_course,v_m3,'Ordena el Reel','Ordena las piezas para conducir desde la atención hacia una acción.','challenge',7,'Ordenar una estructura de contenido.','["Atención","Contexto","Valor","Prueba","Acción"]','{"type":"sequence","items":["CTA","Hook","Valor","Contexto","Prueba"],"correctOrder":[1,3,2,4,0]}',2,'published'),
  (v_course,v_m3,'Guion express','Escribe un guion de 30 segundos que puedas grabar o producir sin aparecer.','challenge',9,'Convertir estructura en guion.','["Hook","Problema","Solución","Resultado","CTA"]','{"type":"builder"}',3,'published'),

  (v_course,v_m4,'La secuencia de 4 Stories','Contexto → problema → valor → CTA crea un recorrido conversacional simple.','content',7,'Comprender secuencias de Stories.','["Contexto","Problema","Valor","CTA"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m4,'Interacción que sí aporta','Encuestas y preguntas pueden ayudarte a conocer y segmentar a la audiencia.','quiz',7,'Distinguir interacciones útiles.','["Pregunta","Intención","Información"]','{"type":"multiple_choice","question":"¿Qué encuesta aporta más información comercial?","options":["¿Te gusta el azul?","¿Qué te cuesta más: empezar o mantener la rutina?","¿Sí o no?","¿Te parece bonito?"],"correctIndex":1}',2,'published'),
  (v_course,v_m4,'Crea tu CTA de conversación','Diseña una llamada a la acción que invite a responder una Story.','challenge',8,'Crear una CTA conversacional.','["Acción","Beneficio","Siguiente paso"]','{"type":"builder"}',3,'published'),

  (v_course,v_m5,'Qué mostrar cuando no muestras tu cara','Puedes construir contenido con pantallas, manos, producto, textos, b-roll y capturas.','content',6,'Descubrir formatos faceless.','["Visual","Narrativa","Contexto"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m5,'Diseña el plano correcto','El recurso visual debe ayudar a comprender la propuesta.','quiz',7,'Relacionar visual y mensaje.','["Claridad","Demostración","Contexto"]','{"type":"multiple_choice","question":"¿Qué plano apoya mejor un contenido sobre ahorro de tiempo?","options":["Paisaje","Cronómetro + proceso simplificado","Logo","Fondo sin contexto"],"correctIndex":1}',2,'published'),
  (v_course,v_m5,'Storyboard rápido','Planifica visualmente una pieza antes de editarla.','challenge',9,'Construir un storyboard simple.','["Escena","Texto","Propósito"]','{"type":"builder"}',3,'published'),

  (v_course,v_m6,'Un CTA, una acción','La claridad del siguiente paso reduce fricción.','content',6,'Elegir una acción adecuada.','["Claridad","Intención","Acción"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m6,'El siguiente paso correcto','No toda persona que ve un Reel está lista para comprar.','quiz',7,'Alinear CTA y nivel de intención.','["Descubrir","Conversar","Comprar"]','{"type":"multiple_choice","question":"Una persona acaba de descubrir tu contenido. ¿Qué CTA es razonable?","options":["Compra ahora","Conoce el producto y mira cómo funciona","Dame datos bancarios","Compra cinco unidades"],"correctIndex":1}',2,'published'),
  (v_course,v_m6,'Construye tu recorrido','Conecta contenido, CTA, enlace y acción esperada.','challenge',9,'Diseñar un recorrido medible.','["Contenido","CTA","Enlace","Acción"]','{"type":"builder"}',3,'published'),

  (v_course,v_m7,'Contenido por intención','Crea piezas para atraer, educar, activar conversación o convertir.','quiz',7,'Distinguir objetivos de contenido.','["Atracción","Educación","Conversación","Conversión"]','{"type":"multiple_choice","question":"¿Qué contenido sirve mejor para educar antes de una oferta?","options":["Explicar un problema y mostrar un método útil","Solo colocar el precio","Publicar el logo","Repetir el CTA de compra"],"correctIndex":0}',1,'published'),
  (v_course,v_m7,'Tu calendario de 7 días','Construye una semana sencilla y sostenible.','challenge',10,'Crear un calendario semanal.','["Tema","Formato","Objetivo","CTA"]','{"type":"planner"}',2,'published'),
  (v_course,v_m7,'Reto final: tu máquina de contenido','Une hook, contenido, CTA, producto y medición en un sistema repetible.','challenge',12,'Crear un sistema inicial de contenido.','["Pilares","Hooks","Formatos","CTA","Métrica"]','{"type":"final_challenge"}',3,'published');

  UPDATE public.course_modules current
  SET required_previous_module_id = prev.id
  FROM public.course_modules prev
  WHERE current.course_id = v_course
    AND prev.course_id = v_course
    AND prev.position = current.position - 1;
END $$;

SELECT 'REBUSCÁNDOME: Curso 03 — Contenido que Vende instalado correctamente' AS result;
