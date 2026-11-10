"use client";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { configSchema } from "@/lib/validation";
import {
  Code2,
  Users,
  HeartHandshake,
  Shuffle,
  ArrowRight,
  MessageSquare,
  Mic,
  Video,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Panel,
  PageHeading,
  Field,
  Badge,
  CheckList,
  Spinner,
} from "@/components/ui/primitives";
import { useDemoStore } from "@/stores/demo-store";
import { interviewService } from "@/services/mock-services";
import { errorMessage } from "@/services/api-client";
import type { InterviewConfig } from "@/types";
import { useDemoReady } from "@/hooks/use-demo-ready";
import { Skeleton } from "@/components/ui/primitives";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { InterviewLimitNotice } from "@/components/plan-access";
import { DEMO_MODE } from "@/lib/mode";
import { LiveInterviewSetup } from "@/features/live/interviews";
export function InterviewSetup({ initialType }: { initialType?: string }) {
  return DEMO_MODE ? <DemoInterviewSetup initialType={initialType} /> : <LiveInterviewSetup initialType={initialType} />;
}
function DemoInterviewSetup({ initialType }: { initialType?: string }) {
  const ready = useDemoReady();
  const { interviews } = useFeatureAccess();
  if (!ready) return <Skeleton />;
  return interviews.canStart ? (
    <SetupForm initialType={initialType} />
  ) : (
    <>
      <PageHeading
        title="Your next practice session"
        description="Your current demo plan has reached its interview allowance."
      />
      <InterviewLimitNotice />
    </>
  );
}
function SetupForm({ initialType }: { initialType?: string }) {
  const router = useRouter();
  const preferences = useDemoStore((s) => s.preferences);
  const beginInterview = useDemoStore((s) => s.beginInterview);
  const { interviews, definition } = useFeatureAccess();
  const type = configSchema.shape.type.safeParse(initialType);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InterviewConfig>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      type: type.success ? type.data : preferences.defaultType,
      role: "Frontend Developer",
      difficulty: "Medium",
      language: "JavaScript",
      duration: 20,
      mode: preferences.defaultMode,
    },
  });
  const values = useWatch({ control });
  async function start(values: InterviewConfig) {
    try {
      const session = await interviewService.create(values);
      if (!beginInterview(session)) {
        toast.error(
          "Your demo interview allowance is used. Review plan access to continue.",
        );
        return;
      }
      router.push(`/interview-room/${session.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE THIS SESSION YOURS"
        title="A little setup. A better practice."
        description={`Choose your focus and pace. ${definition.name}: ${interviews.remaining} of ${interviews.limit} demo sessions remaining.`}
      />
      <form
        onSubmit={handleSubmit(start)}
        noValidate
        className="grid lg:grid-cols-[1.6fr_1fr] gap-6"
      >
        <Panel>
          <h2 className="mb-2">What would you like to practice?</h2>
          <p className="text-subtle text-xs mb-6">
            The interview type determines your predefined question set.
          </p>
          <div
            className="selection-grid mb-7"
            role="group"
            aria-label="Interview type"
          >
            {[
              { name: "Technical", icon: Code2 },
              { name: "HR", icon: Users },
              { name: "Behavioral", icon: HeartHandshake },
              { name: "Mixed", icon: Shuffle },
            ].map((x) => (
              <button
                type="button"
                key={x.name}
                className="selection-card"
                aria-pressed={values.type === x.name}
                onClick={() =>
                  setValue("type", x.name as InterviewConfig["type"])
                }
              >
                <x.icon />
                {x.name}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <Field label="Target job role" error={errors.role?.message}>
                <input
                  placeholder="e.g. Frontend Developer"
                  {...register("role")}
                  aria-invalid={!!errors.role}
                />
              </Field>
            </div>
            <Field label="Difficulty">
              <select {...register("difficulty")}>
                {["Easy", "Medium", "Hard"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Programming language">
              <select {...register("language")}>
                {["Java", "Python", "C++", "JavaScript"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Session duration">
              <select {...register("duration", { valueAsNumber: true })}>
                {[10, 15, 20, 30, 45].map((n) => (
                  <option value={n} key={n}>
                    {n} minutes
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Interview mode">
              <select {...register("mode")}>
                {["Text", "Voice", "Video"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex items-start gap-3 mt-7 p-4 bg-elevated rounded-lg">
            <ShieldCheck size={18} className="text-success shrink-0" />
            <p className="text-muted text-[11px]">
              Camera preview and microphone access are optional. Nothing is
              recorded, uploaded, or transcribed. All modes use typed answers in
              this demo.
            </p>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel>
            <Badge>YOUR SESSION AT A GLANCE</Badge>
            <h2 className="mt-5 mb-2">{values.role || "Your next role"}</h2>
            <p className="text-muted text-xs">
              {values.type} · {values.difficulty} · {values.duration} minutes
            </p>
            <div className="flex items-center gap-2 text-primary text-xs my-6">
              {values.mode === "Text" ? (
                <MessageSquare size={17} />
              ) : values.mode === "Voice" ? (
                <Mic size={17} />
              ) : (
                <Video size={17} />
              )}
              {values.mode} practice
            </div>
            <CheckList
              items={[
                "4 predefined practice questions",
                "Your answers saved in this browser",
                "Sample report after your session",
              ]}
            />
            <Button className="w-full mt-7" disabled={isSubmitting}>
              {isSubmitting ? (
                <Spinner label="Setting up your session…" />
              ) : (
                <>
                  Start my practice
                  <ArrowRight size={15} />
                </>
              )}
            </Button>
          </Panel>
          <div className="px-2">
            <h3 className="text-xs mb-3">
              A good session starts with a breath.
            </h3>
            <p className="text-subtle text-xs leading-6">
              Find a quiet space. Have a project in mind. Don’t worry about
              perfect answers — focus on explaining your thinking.
            </p>
            <p className="text-subtle text-[10px] mt-4">
              Difficulty, role, language, and mode are saved as context. Phase 1
              questions and scores are predefined rather than tailored by AI.
            </p>
          </div>
        </div>
      </form>
    </>
  );
}
