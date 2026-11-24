import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';

describe('Navanegar App Integration UI Smoke Test', () => {
  it('renders DashboardView, all 5 views, and all Phase-1 & Phase-2 studio panels with zero runtime errors', async () => {
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

    // 1. DashboardView + Phase-1 & Phase-2 Panels (Paths & Classical Pieces)
    expect(screen.getByText(/برنامه تمرین روزانه ۱۵ دقیقه‌ای تطبیقی/)).toBeInTheDocument();
    expect(screen.getByText(/آکادمی اختصاصی تربیت گوش ربع‌پرده/)).toBeInTheDocument();
    expect(screen.getByText(/تقویم حرارتی تمرین/)).toBeInTheDocument();
    expect(screen.getByText(/چالش‌های هفتگی ردیف/)).toBeInTheDocument();
    expect(screen.getByText(/مسیرهای یادگیری ساختارمند ۳۰ روزه/)).toBeInTheDocument();
    expect(screen.getByText(/تصنیف‌خانه، پیش‌درآمد، چهارمضراب و رنگ/)).toBeInTheDocument();

    // Open Audio Glossary Modal & close it
    fireEvent.click(screen.getByText(/فرهنگ صوتی/));
    expect(screen.getByText(/فرهنگ صوتی تعاملی اصطلاحات ردیف/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('بستن فرهنگ صوتی'));

    // Open Teacher Assignment Modal & close it
    fireEvent.click(screen.getByText(/کلاس استاد \/ تکلیف/));
    expect(screen.getByText(/حالت کلاس استاد و تکلیف هفتگی/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('بستن'));

    // Open Export, Share Card & Offline JSON Backup Modal & close it
    fireEvent.click(screen.getByText(/کارت پیشرفت و خروجی/));
    expect(screen.getByText(/خروجی استاندارد استودیویی و اشتراک‌گذاری/)).toBeInTheDocument();
    expect(screen.getByText(/پشتیبان‌گیری و بازیابی کامل آفلاین/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('بستن'));

    // 2. PracticeStudioView + All Phase-1 & Phase-2 Workbench Tabs + Kamancheh/Ney + Pedals
    fireEvent.click(screen.getAllByText('کارگاه تمرین')[0]);
    expect(screen.getByText(/عقربه سنت زنده/)).toBeInTheDocument();
    expect(screen.getByText(/خط حامل ایرانی/)).toBeInTheDocument();
    expect(screen.getByText(/منحنی زنده زیر و بمی/)).toBeInTheDocument();
    expect(screen.getByText(/تمرین بدون دست/)).toBeInTheDocument();

    // Bridge Canvas: Kamancheh & Ney visual modes
    fireEvent.click(screen.getByText('کمانچه (۴ سیم)'));
    expect(screen.getByText(/دسته بدون پرده کمانچه/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('نی هفت‌بند'));
    expect(screen.getByText(/نی هفت‌بند ایرانی/)).toBeInTheDocument();

    // Drone, Tombak/Daf Custom Sequencer, Poetry/Traditions
    fireEvent.click(screen.getByText('واخوان (Drone)'));
    expect(screen.getByText(/واخوان \/ پِدال هوشمند دستگاه/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('تنبک و دف'));
    expect(screen.getByText(/ضربی‌ساز و ویرایشگر ریتم تنبک \/ دف/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('شعر، عروض و روایت‌ها'));
    expect(screen.getByText(/کارگاه شعر، عروض و تصنیف‌خوانی/)).toBeInTheDocument();

    // Phase-2 Studio Tabs: Slowdowner, Temperament Editor, Breath & Tahrir Lab
    fireEvent.click(screen.getByText('آهسته‌ساز و نت‌نگار'));
    expect(screen.getByText(/آهسته‌ساز و نت‌نگار خودکار فایل صوتی استاد/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('کوک و ربع‌پرده'));
    expect(screen.getByText(/ویرایشگر کوک و ربع‌پرده‌های اختصاصی/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('نفس و تحریر'));
    expect(screen.getByText(/آزمایشگاه کنترل نفس، نت کشیده/)).toBeInTheDocument();

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
