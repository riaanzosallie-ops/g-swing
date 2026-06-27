import CourseMapper from "@/components/gswing/admin/CourseMapper";
import { MembershipGate } from "@/components/gswing/membership/MembershipGate";

export default function GswingCourseMapperPage() {
  return (
    <MembershipGate featureKey="course.mapper">
      <CourseMapper />
    </MembershipGate>
  );
}