import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ─── Helpers ───────────────────────────────────────────────────────────────
async function getAuth() {
  const { verifyAdminSession } = await import("../auth-admin-helper.server");
  return verifyAdminSession();
}
async function db() {
  const { getDb } = await import("../db.server");
  return getDb();
}
async function audit(actorId: string, action: string, entityType: string, entityId: string, diff: object = {}) {
  const { writeAuditLog } = await import("../audit.server");
  await writeAuditLog({ actorId, action, entityType, entityId, diff });
}

// ─── COURSES ───────────────────────────────────────────────────────────────

export const getAcademyCourses = createServerFn({ method: "POST" })
  .handler(async () => {
    await getAuth();
    const sql = await db();

    return sql`
      SELECT
        c.id,
        c.title,
        c.description,
        c.cover_image_url,
        c.image_url,
        c.intro_video_url,
        c.intro_video_type,
        c.category,
        c.level,
        c.price,
        c.duration_minutes,
        c.is_published,
        c.sort_order,
        c.instructor_name,
        c.instructor_title,
        c.rating,
        c.student_count,
        c.duration,
        c.has_certificate,
        c.youtube_id,
        c.created_at,
        COUNT(DISTINCT cc.id)::int   AS chapter_count,
        COUNT(DISTINCT cl.id)::int   AS lesson_count
      FROM courses c
      LEFT JOIN course_chapters cc ON cc.course_id = c.id
      LEFT JOIN chapter_lessons cl ON cl.chapter_id = cc.id
      WHERE c.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.created_at DESC
    `;
  });

const CourseSchema = z.object({
  title:            z.string().min(3),
  description:      z.string().default(""),
  cover_image_url:  z.string().or(z.literal("")).optional(),
  intro_video_url:  z.string().or(z.literal("")).optional(),
  intro_video_type: z.enum(["youtube", "vimeo", "direct"]).optional(),
  category:         z.string().default("Crop Production"),
  level:            z.enum(["beginner", "intermediate", "advanced", "all_levels"]).default("beginner"),
  price:            z.coerce.number().min(0).default(0),
  duration_minutes: z.coerce.number().min(0).default(0),
  is_published:     z.boolean().default(false),
  instructor_name:  z.string().default(""),
  instructor_title: z.string().default(""),
  has_certificate:  z.boolean().default(false),
  youtube_id:       z.string().default(""),
});

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export const createAcademyCourseV2 = createServerFn({ method: "POST" })
  .inputValidator(CourseSchema)
  .handler(async ({ data }) => {
    const actor = await getAuth();
    const sql   = await db();

    const slug = `${data.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80)}-${Date.now()}`;
    const derivedYtId = data.intro_video_url ? extractYouTubeId(data.intro_video_url) : null;

    const [course] = await sql`
      INSERT INTO courses (
        title, slug, description, cover_image_url, image_url, intro_video_url, intro_video_type,
        category, level, price, duration_minutes, is_published,
        instructor_name, instructor_title, has_certificate, youtube_id,
        rating, student_count, sort_order
      ) VALUES (
        ${data.title}, ${slug}, ${data.description},
        ${data.cover_image_url || null}, ${data.cover_image_url || null}, ${data.intro_video_url || null},
        ${data.intro_video_type || null}, ${data.category}, ${data.level},
        ${data.price}, ${data.duration_minutes}, ${data.is_published},
        ${data.instructor_name}, ${data.instructor_title},
        ${data.has_certificate}, ${derivedYtId || data.youtube_id || null},
        4.5, 0,
        (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM courses WHERE deleted_at IS NULL)
      )
      RETURNING *
    `;

    await audit(actor.id, "academy.course_created", "course", course.id, { title: data.title });
    return course;
  });

export const updateAcademyCourseV2 = createServerFn({ method: "POST" })
  .inputValidator(z.object({ courseId: z.string().uuid() }).merge(CourseSchema.partial()))
  .handler(async ({ data }) => {
    const actor = await getAuth();
    const sql   = await db();

    const { courseId, ...fields } = data;

    // Extract youtube id if video url is changed
    let derivedYtId = undefined;
    if (fields.intro_video_url !== undefined) {
      derivedYtId = fields.intro_video_url ? extractYouTubeId(fields.intro_video_url) : null;
    }

    await sql`
      UPDATE courses SET
        title            = COALESCE(${fields.title ?? null}, title),
        description      = COALESCE(${fields.description ?? null}, description),
        cover_image_url  = COALESCE(${fields.cover_image_url ?? null}, cover_image_url),
        image_url        = COALESCE(${fields.cover_image_url ?? null}, image_url),
        intro_video_url  = COALESCE(${fields.intro_video_url ?? null}, intro_video_url),
        intro_video_type = COALESCE(${fields.intro_video_type ?? null}, intro_video_type),
        category         = COALESCE(${fields.category ?? null}, category),
        level            = COALESCE(${fields.level ?? null}, level),
        price            = COALESCE(${fields.price ?? null}, price),
        duration_minutes = COALESCE(${fields.duration_minutes ?? null}, duration_minutes),
        is_published     = COALESCE(${fields.is_published ?? null}, is_published),
        instructor_name  = COALESCE(${fields.instructor_name ?? null}, instructor_name),
        instructor_title = COALESCE(${fields.instructor_title ?? null}, instructor_title),
        has_certificate  = COALESCE(${fields.has_certificate ?? null}, has_certificate),
        youtube_id       = COALESCE(${derivedYtId !== undefined ? derivedYtId : (fields.youtube_id ?? null)}, youtube_id),
        updated_at       = NOW()
      WHERE id = ${courseId} AND deleted_at IS NULL
    `;

    await audit(actor.id, "academy.course_updated", "course", courseId, fields);
    return { success: true };
  });

export const deleteAcademyCourseV2 = createServerFn({ method: "POST" })
  .inputValidator(z.object({ courseId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const actor = await getAuth();
    const sql   = await db();

    await sql`UPDATE courses SET deleted_at = NOW() WHERE id = ${data.courseId}`;
    await audit(actor.id, "academy.course_deleted", "course", data.courseId);
    return { success: true };
  });

export const publishToggleCourse = createServerFn({ method: "POST" })
  .inputValidator(z.object({ courseId: z.string().uuid(), isPublished: z.boolean() }))
  .handler(async ({ data }) => {
    const actor = await getAuth();
    const sql   = await db();

    await sql`UPDATE courses SET is_published = ${data.isPublished}, updated_at = NOW() WHERE id = ${data.courseId}`;
    await audit(actor.id, data.isPublished ? "academy.course_published" : "academy.course_unpublished", "course", data.courseId);
    return { success: true };
  });

// ─── CHAPTERS ──────────────────────────────────────────────────────────────

export const getChapters = createServerFn({ method: "POST" })
  .inputValidator(z.object({ courseId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await getAuth();
    const sql = await db();

    return sql`
      SELECT
        cc.*,
        COUNT(cl.id)::int AS lesson_count
      FROM course_chapters cc
      LEFT JOIN chapter_lessons cl ON cl.chapter_id = cc.id
      WHERE cc.course_id = ${data.courseId}
      GROUP BY cc.id
      ORDER BY cc.sort_order ASC, cc.created_at ASC
    `;
  });

export const getLessons = createServerFn({ method: "POST" })
  .inputValidator(z.object({ chapterId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await getAuth();
    const sql = await db();

    return sql`
      SELECT * FROM chapter_lessons
      WHERE chapter_id = ${data.chapterId}
      ORDER BY sort_order ASC, created_at ASC
    `;
  });

export const upsertChapter = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id:               z.string().uuid().optional(),
    course_id:        z.string().uuid(),
    title:            z.string().min(1),
    description:      z.string().optional().default(""),
    sort_order:       z.number().int().min(0).default(0),
    duration_minutes: z.number().int().min(0).default(0),
    is_published:     z.boolean().default(false),
  }))
  .handler(async ({ data }) => {
    const actor = await getAuth();
    const sql   = await db();

    if (data.id) {
      const [ch] = await sql`
        UPDATE course_chapters SET
          title            = ${data.title},
          description      = ${data.description},
          sort_order       = ${data.sort_order},
          duration_minutes = ${data.duration_minutes},
          is_published     = ${data.is_published},
          updated_at       = NOW()
        WHERE id = ${data.id}
        RETURNING *
      `;
      return ch;
    }

    const [ch] = await sql`
      INSERT INTO course_chapters (course_id, title, description, sort_order, duration_minutes, is_published)
      VALUES (${data.course_id}, ${data.title}, ${data.description}, ${data.sort_order}, ${data.duration_minutes}, ${data.is_published})
      RETURNING *
    `;
    await audit(actor.id, "academy.chapter_created", "course_chapter", ch.id, { title: data.title });
    return ch;
  });

export const deleteChapter = createServerFn({ method: "POST" })
  .inputValidator(z.object({ chapterId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const actor = await getAuth();
    const sql   = await db();

    await sql`DELETE FROM course_chapters WHERE id = ${data.chapterId}`;
    await audit(actor.id, "academy.chapter_deleted", "course_chapter", data.chapterId);
    return { success: true };
  });

export const reorderChapters = createServerFn({ method: "POST" })
  .inputValidator(z.object({ courseId: z.string().uuid(), orderedIds: z.array(z.string().uuid()) }))
  .handler(async ({ data }) => {
    await getAuth();
    const sql = await db();

    await Promise.all(
      data.orderedIds.map((id, idx) =>
        sql`UPDATE course_chapters SET sort_order = ${idx} WHERE id = ${id} AND course_id = ${data.courseId}`
      )
    );
    return { success: true };
  });

// ─── LESSONS ───────────────────────────────────────────────────────────────

export const upsertLesson = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id:                      z.string().uuid().optional(),
    chapter_id:              z.string().uuid(),
    title:                   z.string().min(1),
    content_type:            z.enum(["video", "text", "pdf", "quiz"]),
    video_url:               z.string().or(z.literal("")).optional(),
    video_type:              z.enum(["youtube", "vimeo", "direct"]).optional(),
    video_duration_seconds:  z.coerce.number().int().min(0).optional(),
    text_content:            z.string().optional(),
    pdf_url:                 z.string().or(z.literal("")).optional(),
    sort_order:              z.coerce.number().int().min(0).default(0),
    is_free_preview:         z.boolean().default(false),
  }))
  .handler(async ({ data }) => {
    const actor = await getAuth();
    const sql   = await db();

    if (data.id) {
      const [lesson] = await sql`
        UPDATE chapter_lessons SET
          title                  = ${data.title},
          content_type           = ${data.content_type},
          video_url              = ${data.video_url || null},
          video_type             = ${data.video_type || null},
          video_duration_seconds = ${data.video_duration_seconds ?? null},
          text_content           = ${data.text_content || null},
          pdf_url                = ${data.pdf_url || null},
          sort_order             = ${data.sort_order},
          is_free_preview        = ${data.is_free_preview}
        WHERE id = ${data.id}
        RETURNING *
      `;
      return lesson;
    }

    const [lesson] = await sql`
      INSERT INTO chapter_lessons (
        chapter_id, title, content_type, video_url, video_type,
        video_duration_seconds, text_content, pdf_url, sort_order, is_free_preview
      ) VALUES (
        ${data.chapter_id}, ${data.title}, ${data.content_type},
        ${data.video_url || null}, ${data.video_type || null},
        ${data.video_duration_seconds ?? null}, ${data.text_content || null},
        ${data.pdf_url || null}, ${data.sort_order}, ${data.is_free_preview}
      )
      RETURNING *
    `;
    await audit(actor.id, "academy.lesson_created", "chapter_lesson", lesson.id, { title: data.title });
    return lesson;
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .inputValidator(z.object({ lessonId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const actor = await getAuth();
    const sql   = await db();

    await sql`DELETE FROM chapter_lessons WHERE id = ${data.lessonId}`;
    await audit(actor.id, "academy.lesson_deleted", "chapter_lesson", data.lessonId);
    return { success: true };
  });

export const reorderLessons = createServerFn({ method: "POST" })
  .inputValidator(z.object({ chapterId: z.string().uuid(), orderedIds: z.array(z.string().uuid()) }))
  .handler(async ({ data }) => {
    await getAuth();
    const sql = await db();

    await Promise.all(
      data.orderedIds.map((id, idx) =>
        sql`UPDATE chapter_lessons SET sort_order = ${idx} WHERE id = ${id} AND chapter_id = ${data.chapterId}`
      )
    );
    return { success: true };
  });

export const uploadAcademyFile = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    fileName: z.string(),
    fileContentBase64: z.string(),
  }))
  .handler(async ({ data }) => {
    await getAuth();
    const fs = await import("node:fs");
    const path = await import("node:path");
    
    // Validate filename to prevent path traversal
    const safeName = path.basename(data.fileName).replace(/[^a-zA-Z0-9_.-]/g, "_");
    
    let baseDir = process.cwd();
    if (!fs.existsSync(path.join(baseDir, 'public'))) {
      baseDir = path.dirname(baseDir);
    }
    if (!fs.existsSync(path.join(baseDir, 'public'))) {
      baseDir = '/home/user/NYOTA-Clients/mkulima-hub-c7714688';
    }
    
    const uploadDir = path.join(baseDir, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filePath = path.join(uploadDir, safeName);
    const buffer = Buffer.from(data.fileContentBase64, 'base64');
    fs.writeFileSync(filePath, buffer);
    
    return { url: `/uploads/${safeName}` };
  });
