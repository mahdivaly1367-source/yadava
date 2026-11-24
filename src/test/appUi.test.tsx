import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';

describe('Navanegar App Integration UI Smoke Test', () => {
  it('renders DashboardView, all 5 views, and all 13 advanced studio panels with zero runtime errors', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/پیشنهاد هوشمند جلسه بعدی/)).toBeInTheDocument();
    });

    // 1. DashboardView + Ear Training Lab + Jalali Heatmap & Challenges
    expect(screen.getByText(/برنامه تمرین روزانه ۱۵ دقیقه‌ای تطبیقی/)).toBeInTheDocument();
    expect(screen.getByText(/آکادمی اختصاصی تربیت گوش ربع‌پرده/)).toBeInTheDocument();
    expect(screen.getByText(/تقویم حرارتی تمرین/)).toBeInTheDocument();
    expect(screen.getByText(/چالش‌های هفتگی ردیف/)).toBeInTheDocument();

    // Open Teacher Assignment Modal & close it
    fireEvent.click(screen.getByText(/کلاس استاد \/ تکلیف/));
    expect(screen.getByText(/حالت کلاس استاد و تکلیف هفتگی/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('بستن'));

    // Open Export & Share Card Modal & close it
    fireEvent.click(screen.getByText(/کارت پیشرفت و خروجی/));
    expect(screen.getByText(/خروجی استاندارد استودیویی و اشتراک‌گذاری/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('بستن'));

    // 2. PracticeStudioView + Pitch Contour + Drone + Tombak/Daf + Poetry/Traditions + Web MIDI
    fireEvent.click(screen.getAllByText('کارگاه تمرین')[0]);
    expect(screen.getByText(/عقربه سنت زنده/)).toBeInTheDocument();
    expect(screen.getByText(/خط حامل ایرانی/)).toBeInTheDocument();
    expect(screen.getByText(/منحنی زنده زیر و بمی/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('واخوان (Drone)'));
    expect(screen.getByText(/واخوان \/ پِدال هوشمند دستگاه/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('تنبک و دف'));
    expect(screen.getByText(/ضربی‌ساز و هم‌نواز تنبک \/ دف/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('شعر، عروض و روایت‌ها'));
    expect(screen.getByText(/کارگاه شعر، عروض و تصنیف‌خوانی/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('کیبورد MIDI / OTG'));
    expect(screen.getByText(/اتصال آفلاین کیبورد MIDI/)).toBeInTheDocument();

    // 3. RadifExplorerView + 4-Tradition Repertoire Switcher
    fireEvent.click(screen.getAllByText('مرورگر ردیف')[0]);
    expect(screen.getByText(/مرورگر جامع ردیف موسیقی اصیل ایرانی/)).toBeInTheDocument();
    expect(screen.getByText(/نمایش ۱۷۳ گوشه در ۱۲ نظام/)).toBeInTheDocument();
    expect(screen.getByText(/روایت فعال ردیف/)).toBeInTheDocument();

    // 4. ModulationMapView
    fireEvent.click(screen.getAllByText('نقشه مدولاسیون')[0]);
    expect(screen.getByText(/نقشه تعاملی مدولاسیون و مرکب‌خوانی ردیف/)).toBeInTheDocument();

    // 5. CommunityView
    fireEvent.click(screen.getAllByText('انجمن زنده')[0]);
    expect(screen.getByText(/انجمن موسیقی‌دانان و اتاق‌های تمرین زنده/)).toBeInTheDocument();

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
