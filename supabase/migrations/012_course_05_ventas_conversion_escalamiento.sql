-- REBUSCÁNDOME — Curso 05: Ventas, Conversión y Escalamiento
-- 7 módulos / 21 lecciones. Usa course_modules y lessons existentes.

DO $$
DECLARE v_course uuid; v_m1 uuid; v_m2 uuid; v_m3 uuid; v_m4 uuid; v_m5 uuid; v_m6 uuid; v_m7 uuid;
BEGIN
  INSERT INTO public.courses(title,slug,description,type,status)
  VALUES('Ventas, Conversión y Escalamiento','ventas-conversion-escalamiento','Aprende a leer el embudo, diagnosticar fricciones, mejorar conversión, optimizar procesos y escalar con criterio.','general','published')
  ON CONFLICT (slug) DO UPDATE SET title=excluded.title,description=excluded.description,status='published'
  RETURNING id INTO v_course;

  IF v_course IS NULL THEN SELECT id INTO v_course FROM public.courses WHERE slug='ventas-conversion-escalamiento'; END IF;

  INSERT INTO public.course_modules(course_id,title,slug,description,position,estimated_minutes,icon,color_key,status)
  VALUES
  (v_course,'Entiende la conversión','entiende-la-conversion','Comprende qué sucede entre un click y una venta.',1,21,'🎯','blue','published'),
  (v_course,'Mide lo que importa','mide-lo-que-importa','Convierte métricas en decisiones útiles.',2,23,'📊','yellow','published'),
  (v_course,'Optimiza tu oferta','optimiza-tu-oferta','Mejora claridad, confianza y fricción antes de buscar más tráfico.',3,23,'💎','green','published'),
  (v_course,'Convierte con confianza','convierte-con-confianza','Reduce incertidumbre sin manipular al comprador.',4,24,'🤝','blue','published'),
  (v_course,'Mejora tu proceso de venta','mejora-tu-proceso-de-venta','Haz que tu sistema sea repetible y medible.',5,23,'🔁','yellow','published'),
  (v_course,'Escala con criterio','escala-con-criterio','Aprende cuándo aumentar esfuerzo y cuándo corregir primero.',6,23,'🚀','green','published'),
  (v_course,'Tu tablero de crecimiento','tu-tablero-de-crecimiento','Integra métricas, hipótesis y acciones en un sistema de mejora continua.',7,28,'🏆','navy','published')
  ON CONFLICT (course_id,slug) DO UPDATE SET title=excluded.title,description=excluded.description,position=excluded.position,estimated_minutes=excluded.estimated_minutes,icon=excluded.icon,color_key=excluded.color_key,status='published';

  SELECT id INTO v_m1 FROM public.course_modules WHERE course_id=v_course AND slug='entiende-la-conversion';
  SELECT id INTO v_m2 FROM public.course_modules WHERE course_id=v_course AND slug='mide-lo-que-importa';
  SELECT id INTO v_m3 FROM public.course_modules WHERE course_id=v_course AND slug='optimiza-tu-oferta';
  SELECT id INTO v_m4 FROM public.course_modules WHERE course_id=v_course AND slug='convierte-con-confianza';
  SELECT id INTO v_m5 FROM public.course_modules WHERE course_id=v_course AND slug='mejora-tu-proceso-de-venta';
  SELECT id INTO v_m6 FROM public.course_modules WHERE course_id=v_course AND slug='escala-con-criterio';
  SELECT id INTO v_m7 FROM public.course_modules WHERE course_id=v_course AND slug='tu-tablero-de-crecimiento';

  INSERT INTO public.lessons(course_id,module_id,title,content,lesson_type,estimated_minutes,objective,key_points,interactive_data,position,status) VALUES
  (v_course,v_m1,'Click no es venta','Un click demuestra interés suficiente para visitar una oferta, pero no garantiza una compra.','content',6,'Distinguir tráfico de conversión.','["Click","Interés","Conversión"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m1,'El embudo simple','Visualiza el recorrido básico de una persona hasta la compra.','interactive',7,'Ordenar etapas de conversión.','["Descubrimiento","Interés","Oferta","Click","Venta"]','{"type":"sequence","items":["Venta","Click","Interés","Oferta","Descubrimiento"],"correctOrder":[4,2,3,1,0]}',2,'published'),
  (v_course,v_m1,'Encuentra la fuga','Aprende a identificar la etapa con mayor fricción.','quiz',8,'Diagnosticar un cuello de botella.','["Fricción","Checkout","Oferta"]','{"type":"multiple_choice","question":"Tienes 1.000 clicks, 90 visitas a checkout y 2 ventas. ¿Qué revisarías primero?","options":["El nombre del afiliado","La etapa checkout/oferta y sus objeciones","Cambiar todos los canales","Eliminar las estadísticas"],"correctIndex":1}',3,'published'),

  (v_course,v_m2,'Tus métricas esenciales','Clicks, ventas, conversión y comisión cuentan una historia básica.','content',7,'Seleccionar métricas útiles.','["Clicks","Ventas","Conversión","Comisión"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m2,'Calcula la conversión','Practica una fórmula fundamental.','quiz',8,'Calcular conversión.','["Ventas","Clicks","Conversión"]','{"type":"multiple_choice","question":"Con 500 clicks y 10 ventas, ¿cuál es la conversión?","options":["0,5%","1%","2%","5%"],"correctIndex":2}',2,'published'),
  (v_course,v_m2,'EPC: valor por click','Aprende a usar el EPC como referencia para comparar rendimiento.','challenge',8,'Calcular EPC y proponer una mejora.','["EPC","Comisión","Clicks"]','{"type":"builder"}',3,'published'),

  (v_course,v_m3,'¿Dónde está la fricción?','Revisa promesa, prueba, claridad, precio y CTA.','scenario',7,'Formular hipótesis de conversión.','["Oferta","CTA","Fricción"]','{"type":"multiple_choice","question":"La landing tiene mucho tráfico pero poca interacción con el CTA. ¿Qué hipótesis es razonable?","options":["Hay que publicar más","El CTA puede no comunicar con claridad la acción y su valor","El afiliado necesita otro logo","No hace falta revisar nada"],"correctIndex":1}',1,'published'),
  (v_course,v_m3,'Prueba una sola variable','Optimizar no significa cambiar diez cosas a la vez.','content',7,'Diseñar un experimento controlado.','["Hipótesis","Variable","Métrica"]','{"type":"challenge"}',2,'published'),
  (v_course,v_m3,'Construye tu hipótesis','Convierte una observación en un experimento medible.','challenge',8,'Crear una hipótesis concreta.','["Cambio","Razón","Métrica"]','{"type":"builder"}',3,'published'),

  (v_course,v_m4,'Confianza antes que presión','La confianza necesita claridad, evidencia y condiciones comprensibles.','content',7,'Identificar factores de confianza.','["Claridad","Prueba","Riesgo"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m4,'Objeción: No estoy seguro','Practica una respuesta útil a una duda de encaje.','simulation',9,'Responder con claridad y sin presión.','["Encaje","Valor","Respeto"]','{"type":"multiple_choice","question":"Cliente: No estoy seguro de que sea para mí. ¿Qué respuesta es más útil?","options":["Te estás perdiendo una oportunidad.","Entiendo. Revisemos para quién está pensado y qué resultado busca; así puedes valorar si encaja contigo.","Todos lo compran.","Compra primero y averigua después."],"correctIndex":1}',2,'published'),
  (v_course,v_m4,'La decisión informada','Un buen CTA deja claro el siguiente paso y permite decidir con información.','scenario',8,'Cerrar con respeto.','["CTA","Claridad","Decisión"]','{"type":"multiple_choice","question":"¿Qué cierre mantiene claridad y respeto?","options":["Si no compras hoy, perdiste.","Si te encaja, aquí tienes la información y el enlace para revisar la oferta.","No lo pienses.","Mándame tu dinero y luego te explico."],"correctIndex":1}',3,'published'),

  (v_course,v_m5,'De improvisar a repetir','Define un flujo comercial que puedas repetir y medir.','content',7,'Diseñar un proceso.','["Contenido","Enlace","Conversación","Medición"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m5,'Detecta el cuello de botella','Encuentra la etapa que restringe el resultado del sistema.','quiz',8,'Diagnosticar un cuello de botella.','["Embudo","Fricción","Prioridad"]','{"type":"multiple_choice","question":"Tienes mucho alcance, muchos clicks pero casi ningún inicio de checkout. ¿Dónde mirarías?","options":["Solo el logo","El mensaje, oferta y transición entre contenido y landing","La foto de perfil","La cantidad de emojis"],"correctIndex":1}',2,'published'),
  (v_course,v_m5,'Diseña tu checklist diario','Crea una rutina concreta de generación y medición.','challenge',8,'Crear hábitos medibles.','["Acciones","Frecuencia","Medición"]','{"type":"builder"}',3,'published'),

  (v_course,v_m6,'No escales una fuga','Más tráfico no arregla una oferta que convierte mal.','content',7,'Decidir cuándo optimizar antes de escalar.','["Conversión","Tráfico","Riesgo"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m6,'¿Qué canal merece más atención?','Compara canales por calidad del resultado, no solo por volumen.','scenario',8,'Comparar canales.','["Clicks","Ventas","Conversión"]','{"type":"multiple_choice","question":"Instagram: 900 clicks y 4 ventas. WhatsApp: 220 clicks y 5 ventas. ¿Qué analizarías?","options":["Elegir Instagram por tener más clicks","Comparar conversión, comisión y contexto antes de decidir","Eliminar WhatsApp","Elegir al azar"],"correctIndex":1}',2,'published'),
  (v_course,v_m6,'Presupuesto y riesgo','Una prueba paga debe tener límites, hipótesis y una métrica de decisión.','quiz',8,'Planificar una prueba responsable.','["Presupuesto","Hipótesis","Métrica"]','{"type":"multiple_choice","question":"¿Qué enfoque es más responsable para una primera prueba paga?","options":["Gastar todo de una vez","Definir un presupuesto de prueba, hipótesis y métrica antes de empezar","Copiar una campaña sin medir","Cambiar presupuesto cada hora sin criterio"],"correctIndex":1}',3,'published'),

  (v_course,v_m7,'Tu tablero semanal','Convierte datos semanales en decisiones.','challenge',8,'Construir un tablero de revisión.','["Métricas","Objetivo","Acción"]','{"type":"builder"}',1,'published'),
  (v_course,v_m7,'Diagnóstico completo','Prioriza la intervención más importante según la evidencia.','simulation',10,'Resolver un caso de rendimiento.','["Conversión","Impacto","Evidencia"]','{"type":"multiple_choice","question":"Tus clicks crecieron 40%, la conversión cayó de 2,8% a 1,4% y la comisión apenas subió. ¿Qué harías primero?","options":["Comprar aún más tráfico","Investigar la caída de conversión y revisar oferta/recorrido","Cambiar de nicho de inmediato","Ignorar la métrica"],"correctIndex":1}',2,'published'),
  (v_course,v_m7,'Tu plan de 30 días','Cierra el curso con un plan ejecutable de crecimiento.','challenge',10,'Diseñar un plan de 30 días.','["Objetivos","Acciones","Métricas"]','{"type":"builder"}',3,'published');

  update public.course_modules current_module
  set required_previous_module_id=previous_module.id
  from public.course_modules previous_module
  where current_module.course_id=v_course
    and previous_module.course_id=v_course
    and previous_module.position=current_module.position-1;
END $$;

select 'REBUSCÁNDOME: Curso 05 instalado correctamente' as result;
