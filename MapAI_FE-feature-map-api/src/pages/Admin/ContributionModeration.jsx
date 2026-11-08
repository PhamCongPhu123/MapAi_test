import { Link, useNavigate } from 'react-router-dom';
import ContributionList from '../../components/Community/ContributionList';

export default function ContributionModeration() {
  const navigate = useNavigate();
  return <section className="max-w-4xl mx-auto space-y-5">
    <header className="space-y-2"><h1 className="text-2xl font-bold">Duyệt địa điểm cộng đồng</h1>
      <p className="text-slate-400">Kiểm tra tên, địa chỉ và vị trí trước khi duyệt. Chỉ địa điểm đã duyệt mới hiển thị công khai.</p>
      <Link className="text-blue-400 underline" to="/map">Mở bản đồ để đối chiếu tọa độ</Link>
    </header>
    <ContributionList moderation onView={place => navigate(`/map?lat=${place.latitude}&lng=${place.longitude}`)} />
  </section>;
}
